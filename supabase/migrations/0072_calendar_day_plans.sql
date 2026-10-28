-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.

-- 0072: Calendar-driven workout plans. A day_plan is EITHER a recurring weekday
-- plan (weekday 0=Sun..6=Sat) OR a one-off override (plan_date). Resolve a date:
-- date override if present, else the weekday plan. Each exercise carries a link.

create table if not exists day_plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references users(id) on delete cascade,
  weekday int check (weekday between 0 and 6),
  plan_date date,
  title text,
  created_at timestamptz default now(),
  check ((weekday is null) <> (plan_date is null))
);
create unique index if not exists uniq_dayplan_weekday on day_plans(client_id, weekday) where plan_date is null;
create unique index if not exists uniq_dayplan_date on day_plans(client_id, plan_date) where weekday is null;

create table if not exists day_plan_exercises (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references users(id) on delete cascade,
  plan_id uuid not null references day_plans(id) on delete cascade,
  name text not null, target_sets int, target_reps text, target_weight numeric(6,2),
  video_url text, sort_order int not null default 0
);
create index if not exists idx_dpe_plan on day_plan_exercises(plan_id);

alter table day_plans enable row level security;
alter table day_plan_exercises enable row level security;

do $$
declare t text;
begin
  foreach t in array array['day_plans','day_plan_exercises'] loop
    execute format('create policy %1$s_client_all on %1$s for all using (client_id = auth.uid()) with check (client_id = auth.uid());', t);
    execute format('create policy %1$s_trainer_all on %1$s for all using (fn_is_my_client(client_id)) with check (fn_is_my_client(client_id));', t);
  end loop;
end $$;
