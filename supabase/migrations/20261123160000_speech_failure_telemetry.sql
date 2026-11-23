-- Allow read-aloud failures to be reported in the reliability monitoring.
alter table public.client_issue_days drop constraint if exists client_issue_days_kind_check;
alter table public.client_issue_days add constraint client_issue_days_kind_check check (kind in ('sync_failed','workout_save_failed','speech_failed'));
