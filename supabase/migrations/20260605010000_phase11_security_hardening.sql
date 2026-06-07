-- CrisisMapper — Phase 11 follow-up: security hardening (clears Supabase advisors for the
-- objects the gamification/privacy migration added). All low-risk, no behaviour change.
--
-- 1. Pin search_path on the functions Phase 11 created/recreated. For SECURITY DEFINER
--    functions a mutable search_path is a real hardening gap; pinning also makes PostGIS
--    resolution deterministic. `extensions` is included where the body touches PostGIS
--    (ST_Y/ST_X in notify_new_report, the && operator in get_crisis_reports);
--    realtime.send is already schema-qualified so it is unaffected.
ALTER FUNCTION public.get_crisis_reports(uuid, geometry)        SET search_path = public, extensions;
ALTER FUNCTION public.notify_new_report()                       SET search_path = public, extensions;
ALTER FUNCTION public.after_insert_damage_report_badges()       SET search_path = public;

-- 2. evaluate_reporter_badges() and notify_new_report() are internal — the former is only
--    called by the badge trigger, the latter IS a trigger function. Neither is meant to be
--    invoked over PostgREST (/rest/v1/rpc/...). Triggers fire system-side regardless of the
--    invoking role's EXECUTE privilege, so revoking does not affect badge awarding or the
--    realtime broadcast; it just removes the anon/authenticated RPC surface.
REVOKE EXECUTE ON FUNCTION public.evaluate_reporter_badges(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_new_report()            FROM anon, authenticated, public;

-- get_crisis_reports() intentionally STAYS executable by anon/authenticated — it is the
-- dashboard's read path and returns only the privacy-aggregated public view.

-- NOTE (intentional, not fixed): the `security_definer_view` advisor on crisis_reports_public
-- is by design. The view must run with the owner's privileges so anon can read the
-- aggregated, non-PII columns while RLS on damage_reports blocks the base table; a
-- security_invoker view would return zero rows to anon and break the public dashboard.
