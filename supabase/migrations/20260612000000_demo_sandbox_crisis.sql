-- Global demo sandbox: a catch-all crisis so a reporter anywhere on Earth always has
-- a valid zone to report into (judges, testers, demos). Client crisis resolution is
-- smallest-bbox-wins, so any real crisis zone always shadows this worldwide envelope.
INSERT INTO crises (id, name, crisis_type, bbox, is_active)
VALUES (
  '018f3c2a-0002-7000-8000-000000000002',
  'Demo Sandbox (Global)',
  'other',
  ST_MakeEnvelope(-180, -85, 180, 85, 4326),
  true
)
ON CONFLICT (id) DO NOTHING;
