-- Seed a fixed-UUID demo crisis for Phase 2 PWA testing.
-- All /report submissions attach to this crisis until multi-crisis routing lands (Phase 7).
-- UUID is hardcoded so it can be set in NUXT_PUBLIC_DEMO_CRISIS_ID without a DB lookup.
INSERT INTO crises (id, name, crisis_type, bbox, is_active)
VALUES (
  '018f3c2a-0001-7000-8000-000000000001',
  'Myanmar Earthquake 2026',
  'earthquake',
  ST_MakeEnvelope(95.8, 21.5, 96.5, 22.2, 4326),
  true
)
ON CONFLICT (id) DO NOTHING;
