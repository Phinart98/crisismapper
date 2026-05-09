-- Phase 2 hardening: the original crisis_reports_public view exposed photo_url
-- and raw location to anon, despite a comment claiming otherwise. The damage-photos
-- bucket is public, so any URL leaked here is directly dereferenceable.
--
-- Drop photo_url from the anon read path entirely. Raw `location` stays for now
-- (the dashboard isn't built until Phase 7); Phase 10 will add ST_SnapToGrid
-- aggregation here and reintroduce a separate authenticated view for full data.

DROP FUNCTION IF EXISTS get_crisis_reports(UUID, GEOMETRY);
DROP VIEW IF EXISTS crisis_reports_public;

CREATE VIEW crisis_reports_public AS
  SELECT
    id, crisis_id, location, severity, damage_classification,
    infrastructure_type, ai_confidence, channel, submitted_at,
    is_verified, is_duplicate, quality_score
  FROM damage_reports;

-- DROP VIEW above removed Supabase's default grants; restore them explicitly.
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

-- DROP FUNCTION above relied on Supabase's default EXECUTE-to-PUBLIC grant for
-- recreated routines. Make it explicit so this migration is self-contained.
GRANT EXECUTE ON FUNCTION get_crisis_reports(UUID, GEOMETRY) TO anon, authenticated;
