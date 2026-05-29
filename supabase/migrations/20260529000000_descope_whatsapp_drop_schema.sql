-- Descope WhatsApp (2026-05-29): the WhatsApp ingestion channel was cut from the
-- competition (Meta WABA platform lock 131031 + unpublishable app). Remove the
-- WhatsApp-only schema. WhatsApp data rows + Storage photos were deleted first.
drop table if exists whatsapp_sessions;

alter table reporters drop column if exists whatsapp_id_hash;

alter table reporters drop constraint if exists reporters_channel_check;
alter table reporters add constraint reporters_channel_check check (channel in ('pwa'));

alter table damage_reports drop constraint if exists damage_reports_channel_check;
alter table damage_reports add constraint damage_reports_channel_check check (channel in ('pwa'));

alter table damage_reports drop constraint if exists damage_reports_location_method_check;
alter table damage_reports add constraint damage_reports_location_method_check
  check (location_method in ('gps', 'manual_pin', 'plus_code'));
