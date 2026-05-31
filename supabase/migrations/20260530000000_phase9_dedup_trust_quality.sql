-- Phase 9 — Duplicate detection, quality scoring, and behavioral trust scoring.
--
-- The init schema already provisioned damage_reports.is_duplicate / duplicate_of /
-- quality_score (+ the dedup-window partial index) but nothing populated them. This
-- migration adds the trigger logic, plus a pseudonymous reporter identity so trust
-- has a subject to accumulate against.
--
-- Privacy (Webinar Q&A #16/#18 data minimization): reporters are identified only by a
-- one-way HMAC of a client-generated random device id — no phone number, no PII.

-- ── 1. Reporter trust columns + pseudonymous identity ───────────────────────────────
-- whatsapp_id_hash was dropped in the descope; reporters had no identity column left.
ALTER TABLE reporters ADD COLUMN IF NOT EXISTS device_hash TEXT UNIQUE;
ALTER TABLE reporters ADD COLUMN IF NOT EXISTS trust_score NUMERIC(4,3) NOT NULL DEFAULT 0.500;
ALTER TABLE reporters ADD COLUMN IF NOT EXISTS trust_tier TEXT GENERATED ALWAYS AS (
  CASE
    WHEN trust_score < 0.3 THEN 'unverified'
    WHEN trust_score < 0.7 THEN 'contributing'
    ELSE 'trusted'
  END
) STORED;

-- ── 1b. Spatial index for metric proximity + shared "extended fields" predicate ──────
-- The dedup + corroboration lookups use ST_DWithin(location::geography, …, 50) for true
-- metre distance. The base GIST is on the geometry column; the ::geography cast produces a
-- different expression the planner can't match to it, so add a functional GIST on the cast
-- expression. Without this, every insert's proximity check degrades to a seq scan at 500K rows.
CREATE INDEX IF NOT EXISTS damage_reports_location_geog_gist
  ON damage_reports USING GIST ((location::geography));

-- "Has any extended Core-Question field" — shared by the quality-score and trust triggers so
-- the field set is defined once. IMMUTABLE: depends only on the row's own columns.
CREATE OR REPLACE FUNCTION report_has_extended(r damage_reports)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
AS $$
  SELECT r.electricity_status IS NOT NULL OR r.health_status IS NOT NULL
      OR r.community_needs IS NOT NULL OR r.vulnerable_groups IS NOT NULL
      OR r.affected_population IS NOT NULL
$$;

-- ── 2. BEFORE INSERT: duplicate detection + quality score ───────────────────────────
-- Runs before the row is written, so it can set NEW.* atomically (no second UPDATE)
-- and the existing AFTER-INSERT broadcast trigger sees the final is_duplicate value.
-- BEFORE always fires before AFTER, so there is no trigger-ordering conflict.
CREATE OR REPLACE FUNCTION before_insert_damage_report()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  has_extended BOOLEAN := report_has_extended(NEW);
BEGIN
  -- Dedup: any non-duplicate report within 50m of this one, same crisis, last 24h.
  -- ST_DWithin on ::geography gives true metric distance; GIST index keeps it ~15ms at 500K.
  -- ORDER BY submitted_at → link to the earliest (canonical) report in the cluster, so
  -- duplicate_of lineage is deterministic when several candidates are in range.
  SELECT id INTO NEW.duplicate_of
  FROM damage_reports
  WHERE crisis_id = NEW.crisis_id
    AND ST_DWithin(location::geography, NEW.location::geography, 50)
    AND submitted_at > now() - interval '24 hours'
    AND is_duplicate = false
  ORDER BY submitted_at
  LIMIT 1;

  IF NEW.duplicate_of IS NOT NULL THEN
    NEW.is_duplicate := true;
  END IF;

  -- Quality score (0.0–1.0). The photo lands in a second phase (photo_url is NULL at
  -- insert), so "has a photo" is proxied by ai_confidence IS NOT NULL — AI classification
  -- only runs on a captured photo. Offline-without-AI reports under-score the 0.30
  -- photo component slightly; acceptable approximation.
  NEW.quality_score :=
      (CASE WHEN NEW.ai_confidence IS NOT NULL THEN 0.30 ELSE 0 END)
    + (CASE WHEN NEW.ai_confidence >= 0.80 THEN 0.20 ELSE 0 END)
    + (CASE WHEN NEW.location_method = 'gps' THEN 0.15 ELSE 0 END)
    + (CASE WHEN length(coalesce(NEW.description, '')) > 20 THEN 0.10 ELSE 0 END)
    + (CASE WHEN has_extended THEN 0.10 ELSE 0 END)
    + (CASE WHEN NEW.is_duplicate = false THEN 0.15 ELSE 0 END);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_before_insert_damage_report ON damage_reports;
CREATE TRIGGER trg_before_insert_damage_report
  BEFORE INSERT ON damage_reports
  FOR EACH ROW
  EXECUTE FUNCTION before_insert_damage_report();

-- ── 3. AFTER INSERT: behavioral trust scoring ───────────────────────────────────────
-- Only fires for attributed reports. Anonymous (reporter_id IS NULL) reports no-op.
-- Signals are the computable subset of the plan's trust model (the blur penalty is
-- omitted — no blur flag is persisted, and adding one would collect more data).
CREATE OR REPLACE FUNCTION after_insert_damage_report_trust()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  has_extended BOOLEAN := report_has_extended(NEW);
  corroborated BOOLEAN;
  -- Severity grade distance: contradicts AI when the reporter's confirmed severity is
  -- more than two grades away from the model's. negligible=0 … destroyed=3.
  sev_grade INT := array_position(ARRAY['negligible','moderate','severe','destroyed'], NEW.severity);
  ai_grade  INT := array_position(ARRAY['negligible','moderate','severe','destroyed'], NEW.ai_severity);
  delta NUMERIC := 0;
BEGIN
  IF NEW.reporter_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Cross-validation: a DIFFERENT reporter reported within 50m / 24h (Sybil-safe —
  -- one person's many device-ids can't corroborate each other).
  SELECT EXISTS (
    SELECT 1 FROM damage_reports
    WHERE crisis_id = NEW.crisis_id
      AND id <> NEW.id
      AND reporter_id IS NOT NULL
      AND reporter_id <> NEW.reporter_id
      AND submitted_at > now() - interval '24 hours'
      AND ST_DWithin(location::geography, NEW.location::geography, 50)
  ) INTO corroborated;

  delta :=
      (CASE WHEN NEW.ai_confidence >= 0.80 THEN 0.05 ELSE 0 END)
    + (CASE WHEN NEW.location_method = 'gps' THEN 0.03 ELSE 0 END)
    + (CASE WHEN NEW.is_duplicate = false THEN 0.02 ELSE 0 END)
    + (CASE WHEN has_extended THEN 0.02 ELSE 0 END)
    + (CASE WHEN corroborated THEN 0.10 ELSE 0 END)
    + (CASE WHEN sev_grade IS NOT NULL AND ai_grade IS NOT NULL
              AND abs(sev_grade - ai_grade) > 2 THEN -0.08 ELSE 0 END);

  UPDATE reporters
  SET trust_score = LEAST(1.0, GREATEST(0.0, trust_score + delta)),
      report_count = report_count + 1
  WHERE id = NEW.reporter_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_after_insert_damage_report_trust ON damage_reports;
CREATE TRIGGER trg_after_insert_damage_report_trust
  AFTER INSERT ON damage_reports
  FOR EACH ROW
  EXECUTE FUNCTION after_insert_damage_report_trust();

-- ── 4. Don't broadcast duplicates to the live dashboard ─────────────────────────────
-- The map endpoints already filter is_duplicate = false; mirror that on the realtime
-- feed so flagged dupes don't briefly appear as new markers. (BEFORE trigger above has
-- already set NEW.is_duplicate by the time this AFTER trigger runs.)
CREATE OR REPLACE FUNCTION notify_new_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT NEW.is_duplicate THEN
    PERFORM realtime.send(
      jsonb_build_object(
        'id',                  NEW.id,
        'severity',            NEW.severity,
        'lat',                 ST_Y(NEW.location),
        'lng',                 ST_X(NEW.location),
        'infrastructure_type', NEW.infrastructure_type,
        'crisis_id',           NEW.crisis_id,
        'submitted_at',        NEW.submitted_at
      ),
      'reports',
      'crisis:' || NEW.crisis_id::text,
      false  -- is_private=false → PUBLIC topic (realtime.send defaults private=TRUE here)
    );
  END IF;
  RETURN NEW;
END;
$$;
