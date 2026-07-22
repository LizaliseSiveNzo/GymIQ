-- Tag notifications with what they reference so deleting the source also clears the bell.
alter table public.notifications add column if not exists ref_type text;
alter table public.notifications add column if not exists ref_id   uuid;
-- notify_team 4-arg overload + send_announcement/delete_announcement/delete_match updated to tag & purge by ref.
-- (Full bodies applied via MCP migration 0033_notification_refs.)
