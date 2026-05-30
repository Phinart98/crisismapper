-- Phase 7 clustering stress test: 500K synthetic damage reports inside the
-- Myanmar Earthquake 2026 crisis bbox (95.8,21.5 → 96.5,22.2).
--
-- Run in the Supabase SQL editor (or via psql). NOT a migration — this is
-- throwaway load-test data. Cleanup at the bottom.
--
-- IMPORTANT: disable the broadcast trigger first, or the AFTER INSERT trigger
-- calls realtime.send() 500,000 times and floods Realtime / crawls the insert.

ALTER TABLE damage_reports DISABLE TRIGGER trg_notify_new_report;

INSERT INTO damage_reports (
  crisis_id, channel, severity, infrastructure_type,
  location, location_method, submitted_at, description
)
SELECT
  '018f3c2a-0001-7000-8000-000000000001',
  'pwa',
  (ARRAY['negligible','moderate','severe','destroyed'])[1 + floor(random() * 4)::int],
  (ARRAY['building','road','bridge','hospital','school','utility','other'])[1 + floor(random() * 7)::int],
  ST_SetSRID(ST_MakePoint(95.8 + random() * 0.7, 21.5 + random() * 0.7), 4326),
  'gps',
  now() - (random() * 7) * interval '1 day',   -- spread over the last 7 days so the time filter has range
  '[seed]'
FROM generate_series(1, 500000);

ALTER TABLE damage_reports ENABLE TRIGGER trg_notify_new_report;

-- Cleanup when done:
--   ALTER TABLE damage_reports DISABLE TRIGGER trg_notify_new_report;
--   DELETE FROM damage_reports WHERE description = '[seed]';
--   ALTER TABLE damage_reports ENABLE TRIGGER trg_notify_new_report;
