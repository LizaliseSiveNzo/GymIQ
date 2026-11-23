-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.

-- Match lineups: coach picks starters + bench per match
create table if not exists match_lineups (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  status text not null default 'starter' check (status in ('starter','bench')),
  position text,
  created_at timestamptz default now(),
  unique (match_id, player_id)
);
create index if not exists idx_lineup_match on match_lineups(match_id);
alter table match_lineups enable row level security;

drop policy if exists ml_coach_all on match_lineups;
drop policy if exists ml_player_read on match_lineups;
create policy ml_coach_all on match_lineups for all
  using (current_role_of()='admin' or match_id in (select id from matches where team_id in (select fn_coach_team_ids())))
  with check (current_role_of()='admin' or match_id in (select id from matches where team_id in (select fn_coach_team_ids())));
create policy ml_player_read on match_lineups for select using (
  match_id in (select id from matches where team_id = fn_my_team_id()));

create or replace function match_lineup(p_match uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare tid uuid; ok boolean;
begin
  select team_id into tid from matches where id = p_match;
  if tid is null then return '[]'::json; end if;
  ok := current_role_of()='admin'
     or exists (select 1 from teams where id=tid and coach_id=auth.uid())
     or exists (select 1 from players where team_id=tid and user_id=auth.uid());
  if not ok then return '[]'::json; end if;
  return coalesce((select json_agg(row_to_json(t)) from (
    select ml.player_id, u.name, ml.position, ml.status
    from match_lineups ml join players p on p.id=ml.player_id join users u on u.id=p.user_id
    where ml.match_id=p_match order by (ml.status='starter') desc, u.name) t), '[]'::json);
end; $$;
