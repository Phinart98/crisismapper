-- CrisisMapper — Phase 11: Gamification + privacy aggregation
-- Apply via Supabase SQL Editor → paste full file → Run
--
-- Three concerns, one migration:
--   A. Badge awarding — a self-contained evaluator + AFTER INSERT trigger that keeps
--      reporters.badges current from existing damage_reports columns (no new data).
--   B. Privacy aggregation — crisis_reports_public now snaps location to a ~100m grid
--      and fuzzes the timestamp to the hour (UNDP Q16/Q18 data minimization). This is
--      the anon-KEY (PostgREST/client) read path; the dashboard's server endpoints read
--      the base table directly and gain the same aggregation in the API layer (Phase 11
--      server changes), branching on staff session.
--   C. Realtime — the public broadcast topic anon subscribes to must not carry exact
--      coordinates either; snap them in notify_new_report().
--
-- Every object here is ours (damage_reports / reporters / crisis_reports_public / badge
-- fns) — none are PostGIS-owned, so the managed-Supabase 42501 grant wall does not apply.

-- ─── A0. Privacy grid — single source of truth for the ~100m snap ───────────────────
-- The 0.001° (~100m) aggregation grid is the core UNDP Q16/Q18 data-minimization promise;
-- centralize it here so the view, the realtime trigger, and the badge cell logic can't
-- drift. (The server endpoints that read the base table directly mirror this in
-- server/utils/privacy.ts — keep the two in sync.)
-- search_path includes `extensions`: Supabase installs PostGIS there, so ST_SnapToGrid
-- only resolves when extensions is on the path (callers like the badge fn pin search_path).
CREATE OR REPLACE FUNCTION privacy_snap(g geometry)
RETURNS geometry LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, extensions AS $$
  SELECT ST_SnapToGrid(g, 0.001, 0.001)
$$;

-- ─── A1. Badge master rows (display names/descriptions come from i18n; this table is
--          just the code → emoji source of truth). Add the two Phase 11 badges and
--          align the existing emojis to the me.html design. ─────────────────────────
INSERT INTO badges (badge_code, name, description, icon_emoji) VALUES
  ('detail_expert',   'Detail Expert',   'Filled extended context fields on 2+ reports', '🔬'),
  ('community_voice', 'Community Voice',  '25+ total reports across all crises',          '🤝')
ON CONFLICT (badge_code) DO NOTHING;

UPDATE badges SET icon_emoji = '🚨' WHERE badge_code = 'first_responder';
UPDATE badges SET icon_emoji = '🏴' WHERE badge_code = 'pioneer';
UPDATE badges SET icon_emoji = '✓'  WHERE badge_code = 'verified';
UPDATE badges SET icon_emoji = '🗺' WHERE badge_code = 'coverage_hero';
UPDATE badges SET icon_emoji = '🔥' WHERE badge_code = 'streak';

-- ─── A2. Badge evaluator ────────────────────────────────────────────────────────────
-- Returns the COMPLETE set of earned badge codes for a reporter, recomputed from scratch
-- each call (idempotent — no "already earned" bookkeeping). Self-contained over
-- damage_reports so it does not depend on the trust trigger having run first; trigger
-- order is therefore irrelevant. Counts only non-duplicate reports (quality, not volume).
-- SECURITY DEFINER + pinned search_path so it works regardless of the inserting role.
CREATE OR REPLACE FUNCTION evaluate_reporter_badges(p_reporter_id UUID)
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  result            TEXT[] := '{}';
  v_total           INT;
  v_high_conf       INT;
  v_detail          INT;
  v_first_responder BOOLEAN;
  v_pioneer         BOOLEAN;
  v_coverage        BOOLEAN;
  v_streak          BOOLEAN;
BEGIN
  SELECT count(*) INTO v_total
  FROM damage_reports
  WHERE reporter_id = p_reporter_id AND is_duplicate = false;

  IF v_total = 0 THEN
    RETURN '{}';
  END IF;

  -- verified: 3+ reports the model scored high-confidence (≥0.80)
  SELECT count(*) INTO v_high_conf
  FROM damage_reports
  WHERE reporter_id = p_reporter_id AND is_duplicate = false
    AND ai_confidence >= 0.80;

  -- detail_expert: 2+ reports carrying any extended Core-Question field
  SELECT count(*) INTO v_detail
  FROM damage_reports r
  WHERE r.reporter_id = p_reporter_id AND r.is_duplicate = false
    AND report_has_extended(r);

  -- The two ranking badges only ever concern crises THIS reporter is in, so scope the
  -- window scans to those crises (almost always one). Without this each insert re-ranks
  -- every reporter / every cell in the whole table — O(table size) per submission.
  -- Semantics are unchanged: the ranking within each of the reporter's crises is identical.

  -- first_responder: ranks within the first 50 DISTINCT reporters (by their earliest
  -- report) of any crisis they participated in.
  SELECT EXISTS (
    WITH mine AS (
      SELECT DISTINCT crisis_id FROM damage_reports
      WHERE reporter_id = p_reporter_id AND is_duplicate = false
    ),
    reporter_first AS (
      SELECT crisis_id, reporter_id, min(submitted_at) AS first_at
      FROM damage_reports
      WHERE reporter_id IS NOT NULL AND is_duplicate = false
        AND crisis_id IN (SELECT crisis_id FROM mine)
      GROUP BY crisis_id, reporter_id
    ),
    ranked AS (
      SELECT crisis_id, reporter_id,
             row_number() OVER (PARTITION BY crisis_id ORDER BY first_at) AS rnk
      FROM reporter_first
    )
    SELECT 1 FROM ranked WHERE reporter_id = p_reporter_id AND rnk <= 50
  ) INTO v_first_responder;

  -- pioneer: owns ≥1 report that is the earliest in its 100m cell within its crisis.
  SELECT EXISTS (
    WITH cells AS (
      SELECT reporter_id,
             row_number() OVER (
               PARTITION BY crisis_id, privacy_snap(location)
               ORDER BY submitted_at
             ) AS rnk
      FROM damage_reports
      WHERE is_duplicate = false
        AND crisis_id IN (
          SELECT DISTINCT crisis_id FROM damage_reports
          WHERE reporter_id = p_reporter_id AND is_duplicate = false
        )
    )
    SELECT 1 FROM cells WHERE reporter_id = p_reporter_id AND rnk = 1
  ) INTO v_pioneer;

  -- coverage_hero: 5+ distinct 100m cells within a single crisis.
  SELECT EXISTS (
    SELECT 1 FROM damage_reports
    WHERE reporter_id = p_reporter_id AND is_duplicate = false
    GROUP BY crisis_id
    HAVING count(DISTINCT privacy_snap(location)) >= 5
  ) INTO v_coverage;

  -- streak: reports on 3 consecutive calendar days (UTC). Gaps-and-islands:
  -- consecutive dates collapse to a constant (date − row_number) group key.
  SELECT EXISTS (
    WITH days AS (
      SELECT DISTINCT (submitted_at AT TIME ZONE 'UTC')::date AS d
      FROM damage_reports
      WHERE reporter_id = p_reporter_id AND is_duplicate = false
    ),
    grp AS (
      SELECT d - (row_number() OVER (ORDER BY d))::int AS g FROM days
    )
    SELECT 1 FROM grp GROUP BY g HAVING count(*) >= 3
  ) INTO v_streak;

  -- array_append (not ||): a bare string literal makes `text[] || 'x'` ambiguous, and
  -- Postgres resolves it to `text[] || text[]`, trying to parse the word as an array literal.
  IF v_first_responder    THEN result := array_append(result, 'first_responder'); END IF;
  IF v_pioneer            THEN result := array_append(result, 'pioneer');         END IF;
  IF v_high_conf >= 3     THEN result := array_append(result, 'verified');        END IF;
  IF v_coverage           THEN result := array_append(result, 'coverage_hero');   END IF;
  IF v_streak             THEN result := array_append(result, 'streak');          END IF;
  IF v_detail >= 2        THEN result := array_append(result, 'detail_expert');   END IF;
  IF v_total >= 25        THEN result := array_append(result, 'community_voice'); END IF;

  RETURN result;
END;
$$;

-- ─── A3. AFTER INSERT: keep reporters.badges current ────────────────────────────────
-- Only fires for attributed reports. The NEW row is already in the table by AFTER time,
-- so the evaluator (which queries damage_reports) sees it.
CREATE OR REPLACE FUNCTION after_insert_damage_report_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.reporter_id IS NULL THEN
    RETURN NEW;
  END IF;
  -- Gamification must NEVER roll back a citizen's damage report: this trigger runs inside
  -- the insert transaction, so any error in badge evaluation (or a statement timeout on a
  -- large table) would otherwise discard the report itself. Swallow + warn instead — the
  -- badge set self-heals on the reporter's next submission (it's recomputed from scratch).
  BEGIN
    UPDATE reporters
    SET badges = evaluate_reporter_badges(NEW.reporter_id)
    WHERE id = NEW.reporter_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'badge evaluation failed for reporter % (report kept): %', NEW.reporter_id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_after_insert_damage_report_badges ON damage_reports;
CREATE TRIGGER trg_after_insert_damage_report_badges
  AFTER INSERT ON damage_reports
  FOR EACH ROW
  EXECUTE FUNCTION after_insert_damage_report_badges();

-- ─── B. Privacy-aggregate crisis_reports_public ─────────────────────────────────────
-- Snap location to a ~100m grid centroid and truncate the timestamp to the hour so the
-- anon-key direct path can't reconstruct an exact ground-truth point or precise timing.
-- photo_url / reporter_id / description are already absent from this view (PII).
-- get_crisis_reports() RETURNS SETOF this view, so drop it first, then recreate.
DROP FUNCTION IF EXISTS get_crisis_reports(UUID, GEOMETRY);
DROP VIEW IF EXISTS crisis_reports_public;

CREATE VIEW crisis_reports_public AS
  SELECT
    id, crisis_id,
    privacy_snap(location) AS location,                  -- ~100m grid centroid
    severity, damage_classification, infrastructure_type,
    ai_confidence, channel,
    date_trunc('hour', submitted_at)      AS submitted_at, -- time fuzz
    is_verified, is_duplicate, quality_score
  FROM damage_reports;

GRANT SELECT ON crisis_reports_public TO anon, authenticated;

CREATE OR REPLACE FUNCTION get_crisis_reports(
  p_crisis_id UUID,
  p_bbox      GEOMETRY DEFAULT NULL
)
RETURNS SETOF crisis_reports_public
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT * FROM crisis_reports_public
  WHERE crisis_id = p_crisis_id
    AND (p_bbox IS NULL OR location && p_bbox)
  ORDER BY submitted_at DESC
  LIMIT 5000;
$$;
GRANT EXECUTE ON FUNCTION get_crisis_reports(UUID, GEOMETRY) TO anon, authenticated;

-- ─── C. Snap realtime broadcast coordinates ─────────────────────────────────────────
-- The public 'crisis:<id>' topic is delivered to anonymous subscribers, so its payload
-- must be aggregated too. Snap lat/lng to the same 100m grid. Staff get exact precision
-- from the session-aware viewport/delta fetches, not from this broadcast. Keeps the
-- is_duplicate guard (Phase 9) and the explicit private=false (Phase 7 — realtime.send
-- defaults private=TRUE here, which would silently drop the anon subscription).
CREATE OR REPLACE FUNCTION notify_new_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  snapped GEOMETRY := privacy_snap(NEW.location);
BEGIN
  IF NOT NEW.is_duplicate THEN
    PERFORM realtime.send(
      jsonb_build_object(
        'id',                  NEW.id,
        'severity',            NEW.severity,
        'lat',                 ST_Y(snapped),
        'lng',                 ST_X(snapped),
        'infrastructure_type', NEW.infrastructure_type,
        'crisis_id',           NEW.crisis_id,
        'submitted_at',        date_trunc('hour', NEW.submitted_at)
      ),
      'reports',
      'crisis:' || NEW.crisis_id::text,
      false
    );
  END IF;
  RETURN NEW;
END;
$$;
