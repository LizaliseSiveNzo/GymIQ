-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.

-- Phase 2 (items 7 & 8): tagged coach notes + development plan tracker
alter table public.coach_player_notes add column if not exists tag text not null default 'General';
alter table public.coach_player_notes drop constraint if exists coach_player_notes_tag_check;
alter table public.coach_player_notes add constraint coach_player_notes_tag_check
  check (tag in ('Technical','Tactical','Physical','Psychological','Medical','General'));
create index if not exists idx_cpn_player_tag on public.coach_player_notes(player_id, tag);

create table if not exists public.development_goals (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  coach_id uuid references public.users(id) on delete set null,
  title text not null, description text, target_date date,
  status text not null default 'not_started' check (status in ('not_started','in_progress','completed')),
  completed_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.development_milestones (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.development_goals(id) on delete cascade,
  title text not null, done boolean not null default false,
  done_at timestamptz, sort_order integer not null default 0
);
create index if not exists idx_dev_goals_player on public.development_goals(player_id);
create index if not exists idx_dev_ms_goal on public.development_milestones(goal_id);

alter table public.development_goals enable row level security;
alter table public.development_milestones enable row level security;

drop policy if exists dev_goals_coach on public.development_goals;
create policy dev_goals_coach on public.development_goals for all
  using (player_id in (select fn_coach_player_ids())) with check (player_id in (select fn_coach_player_ids()));
drop policy if exists dev_goals_player_read on public.development_goals;
create policy dev_goals_player_read on public.development_goals for select
  using (player_id in (select fn_my_player_ids()));
drop policy if exists dev_goals_admin on public.development_goals;
create policy dev_goals_admin on public.development_goals for all using (current_role_of() = 'admin');

drop policy if exists dev_ms_coach on public.development_milestones;
create policy dev_ms_coach on public.development_milestones for all
  using (goal_id in (select id from public.development_goals where player_id in (select fn_coach_player_ids())))
  with check (goal_id in (select id from public.development_goals where player_id in (select fn_coach_player_ids())));
drop policy if exists dev_ms_player_read on public.development_milestones;
create policy dev_ms_player_read on public.development_milestones for select
  using (goal_id in (select id from public.development_goals where player_id in (select fn_my_player_ids())));
drop policy if exists dev_ms_admin on public.development_milestones;
create policy dev_ms_admin on public.development_milestones for all using (current_role_of() = 'admin');
