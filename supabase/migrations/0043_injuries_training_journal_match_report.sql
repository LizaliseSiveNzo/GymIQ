-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.
-- Phase 3 (items 9, 10, 11): injuries/return-to-play, training journal, match report

create table if not exists public.injuries (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  injury_type text not null, body_area text,
  date_sustained date not null default current_date,
  severity text not null default 'minor' check (severity in ('minor','moderate','severe')),
  expected_return date,
  stage text not null default 'rest' check (stage in ('rest','rehab','partial_training','full_training','match_fit')),
  notes text, resolved_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists idx_injuries_player on public.injuries(player_id);
create index if not exists idx_injuries_open on public.injuries(player_id) where resolved_at is null;
alter table public.injuries enable row level security;
drop policy if exists inj_coach on public.injuries;
create policy inj_coach on public.injuries for all
  using (player_id in (select fn_coach_player_ids())) with check (player_id in (select fn_coach_player_ids()));
drop policy if exists inj_player_read on public.injuries;
create policy inj_player_read on public.injuries for select using (player_id in (select fn_my_player_ids()));
drop policy if exists inj_admin on public.injuries;
create policy inj_admin on public.injuries for all using (current_role_of() = 'admin');

alter table public.training_sessions
  add column if not exists objectives text,
  add column if not exists exercises text,
  add column if not exists observations text,
  add column if not exists reflection text;

create table if not exists public.training_standouts (
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  reason text, created_at timestamptz not null default now(),
  primary key (session_id, player_id)
);
create index if not exists idx_standouts_player on public.training_standouts(player_id);
alter table public.training_standouts enable row level security;
drop policy if exists standouts_coach on public.training_standouts;
create policy standouts_coach on public.training_standouts for all
  using (player_id in (select fn_coach_player_ids())) with check (player_id in (select fn_coach_player_ids()));
drop policy if exists standouts_player_read on public.training_standouts;
create policy standouts_player_read on public.training_standouts for select using (player_id in (select fn_my_player_ids()));
drop policy if exists standouts_admin on public.training_standouts;
create policy standouts_admin on public.training_standouts for all using (current_role_of() = 'admin');

alter table public.matches add column if not exists reflection text;

create table if not exists public.match_substitutions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  player_off uuid references public.players(id) on delete cascade,
  player_on uuid references public.players(id) on delete cascade,
  minute integer, created_at timestamptz not null default now()
);
create index if not exists idx_subs_match on public.match_substitutions(match_id);
alter table public.match_substitutions enable row level security;
drop policy if exists subs_coach on public.match_substitutions;
create policy subs_coach on public.match_substitutions for all
  using (match_id in (select id from public.matches where team_id in (select fn_coach_team_ids())))
  with check (match_id in (select id from public.matches where team_id in (select fn_coach_team_ids())));
drop policy if exists subs_player_read on public.match_substitutions;
create policy subs_player_read on public.match_substitutions for select
  using (match_id in (select id from public.matches where team_id = fn_my_team_id()));
drop policy if exists subs_admin on public.match_substitutions;
create policy subs_admin on public.match_substitutions for all using (current_role_of() = 'admin');
