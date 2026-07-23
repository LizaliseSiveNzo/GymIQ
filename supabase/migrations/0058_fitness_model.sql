-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.

-- 0058: Fitness data model — trainer <-> client progress tracking.
--
-- Design notes
-- • trainer_clients is the direct link (replaces PitchIQ's team-based
--   indirection). A trainer has many clients; Phase 1c invite codes populate it.
-- • Every content table carries a denormalised client_id so RLS is uniform and
--   fast: a client sees rows where client_id = auth.uid(); a trainer sees rows
--   for clients they are actively linked to (fn_is_my_client).
-- • Programme shape supports BOTH a named split (many days) and a simple weekly
--   list (a single day). programme_days is the grouping; a flat list is one day.
-- • Nutrition supports macro targets (nutrition_plans) AND an assigned meal plan
--   (meal_plan_items).
-- Internal roles remain 'coach' (Trainer) and 'player' (Client).

-- ---------- link ----------
create table if not exists trainer_clients (
  id         uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references users(id) on delete cascade,
  client_id  uuid not null references users(id) on delete cascade,
  status     text not null default 'active' check (status in ('active','paused','ended')),
  created_at timestamptz default now(),
  unique (trainer_id, client_id)
);
create index if not exists idx_tc_trainer on trainer_clients(trainer_id);
create index if not exists idx_tc_client  on trainer_clients(client_id);

-- ---------- programmes ----------
create table if not exists workout_programmes (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references users(id) on delete cascade,
  trainer_id uuid references users(id) on delete set null,
  name       text not null,
  is_active  boolean not null default true,
  created_at timestamptz default now()
);
create index if not exists idx_prog_client on workout_programmes(client_id);

create table if not exists programme_days (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references users(id) on delete cascade,
  programme_id uuid not null references workout_programmes(id) on delete cascade,
  name         text not null,               -- 'Push', 'Legs', or 'Week'
  sort_order   int not null default 0
);
create index if not exists idx_pday_prog on programme_days(programme_id);

create table if not exists programme_exercises (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references users(id) on delete cascade,
  day_id        uuid not null references programme_days(id) on delete cascade,
  name          text not null,
  target_sets   int,
  target_reps   text,                        -- '8', '8-12', 'AMRAP'
  target_weight numeric(6,2),
  notes         text,
  sort_order    int not null default 0
);
create index if not exists idx_pex_day on programme_exercises(day_id);

-- ---------- performance logging ----------
create table if not exists workout_logs (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references users(id) on delete cascade,
  day_id     uuid references programme_days(id) on delete set null,
  log_date   date not null default current_date,
  note       text,
  created_at timestamptz default now()
);
create index if not exists idx_wlog_client_date on workout_logs(client_id, log_date desc);

create table if not exists logged_sets (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references users(id) on delete cascade,
  log_id       uuid not null references workout_logs(id) on delete cascade,
  exercise_name text not null,
  programme_exercise_id uuid references programme_exercises(id) on delete set null,
  set_number   int not null default 1,
  weight       numeric(6,2),
  reps         int
);
create index if not exists idx_lset_log on logged_sets(log_id);
create index if not exists idx_lset_client_ex on logged_sets(client_id, exercise_name);

-- ---------- body progress ----------
create table if not exists body_metrics (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references users(id) on delete cascade,
  metric_date   date not null default current_date,
  weight_kg     numeric(6,2),
  body_fat_pct  numeric(4,1),
  measurements  jsonb,                        -- {chest, waist, arms, ...}
  note          text,
  unique (client_id, metric_date)
);
create index if not exists idx_bm_client_date on body_metrics(client_id, metric_date desc);

-- ---------- nutrition ----------
create table if not exists nutrition_plans (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references users(id) on delete cascade,
  trainer_id uuid references users(id) on delete set null,
  is_active  boolean not null default true,
  daily_kcal int,
  protein_g  int,
  carbs_g    int,
  fat_g      int,
  note       text,
  created_at timestamptz default now()
);
create index if not exists idx_nplan_client on nutrition_plans(client_id);

create table if not exists meal_plan_items (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references users(id) on delete cascade,
  plan_id     uuid not null references nutrition_plans(id) on delete cascade,
  meal        text not null,                 -- 'Breakfast', 'Lunch', ...
  description text,
  kcal        int,
  protein_g   int,
  carbs_g     int,
  fat_g       int,
  sort_order  int not null default 0
);
create index if not exists idx_mpi_plan on meal_plan_items(plan_id);

create table if not exists food_logs (
  id        uuid primary key default gen_random_uuid(),
  client_id uuid not null references users(id) on delete cascade,
  log_date  date not null default current_date,
  kcal      int,
  protein_g int,
  carbs_g   int,
  fat_g     int,
  note      text
);
create index if not exists idx_flog_client_date on food_logs(client_id, log_date desc);

-- ============================================================
-- RLS
-- ============================================================
create or replace function fn_is_my_client(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from trainer_clients tc
    where tc.trainer_id = auth.uid() and tc.client_id = c and tc.status = 'active'
  );
$$;
revoke execute on function fn_is_my_client(uuid) from public, anon;
grant execute on function fn_is_my_client(uuid) to authenticated;

alter table trainer_clients     enable row level security;
alter table workout_programmes  enable row level security;
alter table programme_days      enable row level security;
alter table programme_exercises enable row level security;
alter table workout_logs        enable row level security;
alter table logged_sets         enable row level security;
alter table body_metrics        enable row level security;
alter table nutrition_plans     enable row level security;
alter table meal_plan_items     enable row level security;
alter table food_logs           enable row level security;

-- link table
create policy tc_trainer_all on trainer_clients for all
  using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());
create policy tc_client_read on trainer_clients for select
  using (client_id = auth.uid());

-- Structural tables: trainer full control, client read-only.
do $$
declare t text;
begin
  foreach t in array array['workout_programmes','programme_days','programme_exercises',
                           'nutrition_plans','meal_plan_items']
  loop
    execute format(
      'create policy %1$s_trainer_all on %1$s for all
         using (fn_is_my_client(client_id)) with check (fn_is_my_client(client_id));',
      t);
    execute format(
      'create policy %1$s_client_read on %1$s for select
         using (client_id = auth.uid());',
      t);
  end loop;

  -- Client-generated data: client full control on own rows, trainer full too.
  foreach t in array array['workout_logs','logged_sets','body_metrics','food_logs']
  loop
    execute format(
      'create policy %1$s_client_all on %1$s for all
         using (client_id = auth.uid()) with check (client_id = auth.uid());',
      t);
    execute format(
      'create policy %1$s_trainer_all on %1$s for all
         using (fn_is_my_client(client_id)) with check (fn_is_my_client(client_id));',
      t);
  end loop;
end $$;

-- Let a trainer read their linked clients' user rows (name / email).
drop policy if exists trainer_read_client_users on users;
create policy trainer_read_client_users on users for select
  using (fn_is_my_client(id));
