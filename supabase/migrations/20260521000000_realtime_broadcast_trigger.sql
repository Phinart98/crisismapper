-- Phase 7 — Realtime Broadcast on new damage reports.
--
-- The dashboard subscribes to a public Realtime topic per crisis and appends
-- markers as reports arrive. We use BROADCAST (not postgres_changes): a trigger
-- calls realtime.send() so the dashboard never needs replication access to the
-- base table, and the public view's RLS/grants stay untouched.
--
-- realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true)
--   NOTE: in this Realtime version `private` DEFAULTS TO TRUE, so we pass false
--   explicitly below to make this a PUBLIC topic. Verified empirically: an anon
--   client receives public-topic broadcasts with NO RLS policy on realtime.messages,
--   which is exactly what the unauthenticated dashboard needs. (A private topic would
--   silently deliver nothing to the anon subscription.)
--
-- SECURITY DEFINER: the function runs as its owner so it can always insert into
-- realtime.messages regardless of the role performing the INSERT on damage_reports.

CREATE OR REPLACE FUNCTION notify_new_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM realtime.send(
    jsonb_build_object(
      'id',                  NEW.id,
      'severity',            NEW.severity,            -- 4-tier internal value; map colors key off this
      'lat',                 ST_Y(NEW.location),
      'lng',                 ST_X(NEW.location),
      'infrastructure_type', NEW.infrastructure_type,
      'crisis_id',           NEW.crisis_id,
      'submitted_at',        NEW.submitted_at
    ),
    'reports',                                        -- event
    'crisis:' || NEW.crisis_id::text,                 -- topic
    false                                             -- is_private=false → PUBLIC topic.
                                                      -- NOTE: realtime.send defaults private=TRUE in this
                                                      -- Postgres/Realtime version; must pass false explicitly
                                                      -- or the anon dashboard's public subscription gets nothing.
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_report ON damage_reports;
CREATE TRIGGER trg_notify_new_report
  AFTER INSERT ON damage_reports
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_report();

-- No RLS policy on realtime.messages is required: public-topic broadcasts
-- (private=false above) are delivered to anonymous subscribers without one.
-- Verified empirically with an anon-key client receiving the event in <3s.
