-- 0076_form_checks_metrics
-- Store measured pose metrics + rep count from the on-device AI form checker.
alter table form_checks add column if not exists metrics jsonb;
alter table form_checks add column if not exists reps int;
