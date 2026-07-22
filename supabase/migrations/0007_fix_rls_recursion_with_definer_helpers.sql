-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.

-- Break cross-table RLS recursion (teams <-> players <-> matches) via SECURITY DEFINER helpers.
create or replace function fn_coach_team_ids() returns setof uuid language sql stable security definer set search_path=public as $$ select id from teams where coach_id=auth.uid() $$;
create or replace function fn_my_team_id() returns uuid language sql stable security definer set search_path=public as $$ select team_id from players where user_id=auth.uid() limit 1 $$;
create or replace function fn_child_team_ids() returns setof uuid language sql stable security definer set search_path=public as $$ select p.team_id from players p join parent_player pp on pp.player_id=p.id where pp.parent_user_id=auth.uid() $$;
create or replace function fn_child_player_ids() returns setof uuid language sql stable security definer set search_path=public as $$ select player_id from parent_player where parent_user_id=auth.uid() $$;
create or replace function fn_coach_player_user_ids() returns setof uuid language sql stable security definer set search_path=public as $$ select p.user_id from players p where p.team_id in (select id from teams where coach_id=auth.uid()) $$;

drop policy if exists player_read_own_team on teams;
drop policy if exists parent_read_child_team on teams;
create policy player_read_own_team  on teams for select using (id = fn_my_team_id());
create policy parent_read_child_team on teams for select using (id in (select fn_child_team_ids()));

drop policy if exists coach_read_players on players;
drop policy if exists coach_update_players on players;
drop policy if exists parent_read_child on players;
create policy coach_read_players  on players for select using (team_id in (select fn_coach_team_ids()));
create policy coach_update_players on players for update using (team_id in (select fn_coach_team_ids()));
create policy parent_read_child    on players for select using (id in (select fn_child_player_ids()));

drop policy if exists coach_read_player_users on users;
create policy coach_read_player_users on users for select using (id in (select fn_coach_player_user_ids()));

drop policy if exists coach_match_all on matches;
drop policy if exists player_read_matches on matches;
drop policy if exists parent_read_matches on matches;
create policy coach_match_all on matches for all using (team_id in (select fn_coach_team_ids())) with check (team_id in (select fn_coach_team_ids()));
create policy player_read_matches on matches for select using (team_id = fn_my_team_id());
create policy parent_read_matches on matches for select using (team_id in (select fn_child_team_ids()));

drop policy if exists coach_ts_all on training_sessions;
create policy coach_ts_all on training_sessions for all using (team_id in (select fn_coach_team_ids())) with check (team_id in (select fn_coach_team_ids()));

drop policy if exists coach_att_all on attendance;
create policy coach_att_all on attendance for all
  using      (session_id in (select id from training_sessions where team_id in (select fn_coach_team_ids())))
  with check (session_id in (select id from training_sessions where team_id in (select fn_coach_team_ids())));

drop policy if exists coach_stats_all on player_match_stats;
create policy coach_stats_all on player_match_stats for all
  using      (match_id in (select id from matches where team_id in (select fn_coach_team_ids())))
  with check (match_id in (select id from matches where team_id in (select fn_coach_team_ids())));
