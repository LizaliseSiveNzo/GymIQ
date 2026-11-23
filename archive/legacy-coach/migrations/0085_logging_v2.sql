-- 0085_logging_v2
-- Live-session logging upgrades: unilateral columns, RIR, set types, targets,
-- completion flags; workout duration/completion; personal records; daily habits.
-- NOTE: legacy logged_sets never had a timestamp — add it first (the recent-
-- performance index below orders by it).
alter table logged_sets
  add column if not exists created_at timestamptz not null default now();

alter table workout_logs
  add column if not exists gym_profile_id uuid references gym_profiles(id) on delete set null,
  add column if not exists duration_sec int,
  add column if not exists week_number int,
  add column if not exists completed_at timestamptz;

alter table logged_sets
  add column if not exists exercise_id uuid references exercises(id) on delete set null,
  add column if not exists set_type text not null default 'normal'
    check (set_type in ('normal','warmup','drop','myorep','partial','failure','superset')),
  add column if not exists rir int,
  -- left side (unilateral work); right side reuses the original weight/reps columns
  add column if not exists weight_left numeric(6,2),
  add column if not exists reps_left int,
  -- what the engine prescribed for this set (snapshot)
  add column if not exists target_weight numeric(6,2),
  add column if not exists target_rep_min int,
  add column if not exists target_rep_max int,
  add column if not exists target_rir int,
  -- legacy rows were logged after the fact: they are completed by definition
  add column if not exists completed boolean not null default true,
  add column if not exists superset_group uuid;

create index if not exists idx_sets_log on logged_sets(log_id);
create index if not exists idx_sets_recent on logged_sets(client_id, exercise_name, created_at desc);

create table if not exists personal_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  exercise_name text not null,
  pr_type text not null check (pr_type in ('e1rm','volume')),
  value numeric(8,2) not null,
  achieved_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id, exercise_name, pr_type)
);
alter table personal_records enable row level security;
drop policy if exists pr_owner_all on personal_records;
create policy pr_owner_all on personal_records for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on personal_records to authenticated;

create table if not exists habits (
  user_id uuid not null references users(id) on delete cascade,
  day date not null,
  weighed_in boolean not null default false,
  worked_out boolean not null default false,
  logged_food boolean not null default false,
  primary key (user_id, day)
);
alter table habits enable row level security;
drop policy if exists habits_owner_all on habits;
create policy habits_owner_all on habits for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on habits to authenticated;
