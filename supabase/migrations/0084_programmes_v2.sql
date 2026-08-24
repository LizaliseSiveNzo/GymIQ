-- 0084_programmes_v2
-- Extends the legacy trainer-era programme tables for the MF-style generator:
-- metadata on the programme, periodized weeks, day labels, per-exercise
-- prescriptions (sets × rep-range × RIR × rest) and an optional FK to the
-- exercise catalog.
alter table workout_programmes
  add column if not exists goal text check (goal in ('hypertrophy','strength','both')),
  add column if not exists split text,
  add column if not exists days_per_week int,
  add column if not exists session_minutes int,
  add column if not exists focus_muscle_ids text[] default '{}',
  add column if not exists deprioritized_muscle_ids text[] default '{}',
  add column if not exists deload_policy text default 'auto'
    check (deload_policy in ('auto','every_4w','every_6w','never')),
  add column if not exists color text,
  add column if not exists icon text,
  add column if not exists current_week int default 1,
  add column if not exists generated boolean not null default false,
  add column if not exists source text default 'manual'
    check (source in ('generator','manual','import')),
  add column if not exists gym_profile_id uuid references gym_profiles(id) on delete set null;

create table if not exists programme_weeks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references users(id) on delete cascade,
  programme_id uuid not null references workout_programmes(id) on delete cascade,
  week_number int not null,
  kind text not null default 'accumulate' check (kind in ('accumulate','deload')),
  volume_multiplier numeric(4,2) not null default 1.0,
  unique (programme_id, week_number)
);

alter table programme_days
  add column if not exists label text,
  add column if not exists focus_summary text;

alter table programme_exercises
  add column if not exists exercise_id uuid references exercises(id) on delete set null,
  add column if not exists rep_min int,
  add column if not exists rep_max int,
  add column if not exists target_rir int,
  add column if not exists rest_seconds int,
  add column if not exists movement_pattern text;

create index if not exists idx_pweeks_prog on programme_weeks(programme_id);
create index if not exists idx_pex_exercise on programme_exercises(exercise_id);

alter table programme_weeks enable row level security;
drop policy if exists pw_owner_all on programme_weeks;
create policy pw_owner_all on programme_weeks for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());
grant select, insert, update, delete on programme_weeks to authenticated;
