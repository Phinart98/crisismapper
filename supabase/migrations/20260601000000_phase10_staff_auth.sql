-- CrisisMapper — Phase 10: Real staff auth + public/staff data-split foundation
-- Apply via Supabase SQL Editor → paste full file → Run
--
-- Replaces the interim Phase 8 shared-secret (NUXT_ADMIN_KEY) with Supabase
-- magic-link sessions gated to a staff allowlist. Adds the authenticated full-detail
-- view + RLS so direct (anon-key) access is locked down. The app's server routes read
-- through the privileged Supavisor pooler role, which BYPASSES RLS — so none of these
-- policies affect /api/crises, /api/map/reports, etc. They govern only direct
-- anon/authenticated PostgREST/client access (the anon key shipped to browsers).

-- ─── 1. Staff allowlist ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_emails (
  email      TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO staff_emails (email) VALUES ('niiotunarteh@gmail.com')
  ON CONFLICT (email) DO NOTHING;

-- Lock the allowlist down: only SECURITY DEFINER paths (is_staff) read it. The
-- server's getDb() runs as the privileged pooler role and bypasses RLS, so
-- requireStaff() still queries it server-side.
ALTER TABLE staff_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON staff_emails FROM anon, authenticated;
-- (No SELECT policy → anon/authenticated cannot read it directly.)

-- ─── 2. is_staff() — the predicate used by every RLS policy below ───────────────
CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff_emails
    WHERE lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;
-- Only `authenticated` RLS policies reference is_staff(); anon policies key off
-- is_active, so anon needs no EXECUTE (and shouldn't be able to probe via RPC).
REVOKE ALL ON FUNCTION is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_staff() TO authenticated;

-- ─── 3. Authenticated full-detail view (staff dashboard; Phase 11 wires reads) ──
-- security_invoker=true (PG15+) → the view executes with the QUERYING user's
-- privileges, so the damage_reports staff-SELECT policy below actually applies.
-- NB: RLS only kicks in once the role also holds a table-level GRANT, so we GRANT
-- SELECT on damage_reports to `authenticated` and let the staff_select_reports
-- policy (is_staff()) do the gating — the canonical Supabase "grant + RLS" pattern.
-- anon is deliberately NOT granted on damage_reports (it reads crisis_reports_public).
DROP VIEW IF EXISTS crisis_reports_authenticated;
CREATE VIEW crisis_reports_authenticated WITH (security_invoker = true) AS
  SELECT
    id, crisis_id, location, severity, damage_classification, infrastructure_type,
    description, photo_url, ai_confidence, ai_severity, ai_raw_response,
    channel, submitted_at, is_verified, is_duplicate, quality_score
  FROM damage_reports;
GRANT SELECT ON crisis_reports_authenticated TO authenticated;
GRANT SELECT ON damage_reports TO authenticated;

-- ─── 4. damage_reports staff policies (RLS already ON; only reporters_insert) ───
DROP POLICY IF EXISTS staff_select_reports ON damage_reports;
CREATE POLICY staff_select_reports ON damage_reports
  FOR SELECT TO authenticated
  USING (is_staff());

DROP POLICY IF EXISTS staff_update_reports ON damage_reports;
CREATE POLICY staff_update_reports ON damage_reports
  FOR UPDATE TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

-- ─── 5. crises: public reads active zones; staff read all + write ───────────────
ALTER TABLE crises ENABLE ROW LEVEL SECURITY;
-- crises had no anon/authenticated SELECT grant at all; grant it so the policies
-- below actually govern direct client access (RLS without a grant = always denied).
GRANT SELECT ON crises TO anon, authenticated;

DROP POLICY IF EXISTS public_select_active_crises ON crises;
CREATE POLICY public_select_active_crises ON crises
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS staff_select_crises ON crises;
CREATE POLICY staff_select_crises ON crises
  FOR SELECT TO authenticated
  USING (is_staff());   -- staff also see inactive/archived zones

DROP POLICY IF EXISTS staff_write_crises ON crises;
CREATE POLICY staff_write_crises ON crises
  FOR ALL TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

-- ─── 6. Hygiene: enable RLS on the remaining open tables ────────────────────────
-- buildings/reporters are read only via the privileged getDb() path today; turning
-- on RLS with no anon/authenticated policy closes the default-grant direct access
-- without affecting any server route.
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reporters ENABLE ROW LEVEL SECURITY;
