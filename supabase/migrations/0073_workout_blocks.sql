-- 0073_workout_blocks
-- Reusable workout "blocks" (Legs, Push, Arms…) that hold exercises and get
-- dropped onto calendar days. A day plan can carry several blocks. Also adds a
-- per-day meal note to day_plans.

create table if not exists workout_blocks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists block_exercises (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references profiles(id) on delete cascade,
  block_id uuid not null references workout_blocks(id) on delete cascade,
  name text not null,
  target_sets int,
  target_reps text,
  target_weight numeric,
  video_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists day_plan_blocks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references profiles(id) on delete cascade,
  plan_id uuid not null references day_plans(id) on delete cascade,
  block_id uuid not null references workout_blocks(id) on delete cascade,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table day_plans add column if not exists meal_note text;

create index if not exists idx_workout_blocks_client on workout_blocks(client_id);
create index if not exists idx_block_exercises_block on block_exercises(block_id);
create index if not exists idx_day_plan_blocks_plan on day_plan_blocks(plan_id);

alter table workout_blocks enable row level security;
alter table block_exercises enable row level security;
alter table day_plan_blocks enable row level security;

-- Client owns own rows; trainer accesses via fn_is_my_client.
create policy workout_blocks_client_all on workout_blocks
  for all using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy workout_blocks_trainer_all on workout_blocks
  for all using (fn_is_my_client(client_id)) with check (fn_is_my_client(client_id));

create policy block_exercises_client_all on block_exercises
  for all using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy block_exercises_trainer_all on block_exercises
  for all using (fn_is_my_client(client_id)) with check (fn_is_my_client(client_id));

create policy day_plan_blocks_client_all on day_plan_blocks
  for all using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy day_plan_blocks_trainer_all on day_plan_blocks
  for all using (fn_is_my_client(client_id)) with check (fn_is_my_client(client_id));
