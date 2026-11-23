-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.

-- Phase 3: coaches own teams via teams.coach_id; scoped RLS for logging.
alter table teams add column if not exists coach_id uuid references users(id) on delete set null;
create index if not exists idx_teams_coach on teams(coach_id);

create policy coach_read_teams on teams for select using (coach_id = auth.uid());

drop policy if exists coach_read_players on players;
drop policy if exists coach_update_players on players;
create policy coach_read_players on players for select using (
  team_id in (select id from teams where coach_id = auth.uid()));
create policy coach_update_players on players for update using (
  team_id in (select id from teams where coach_id = auth.uid()));

create policy coach_read_player_users on users for select using (
  id in (select p.user_id from players p join teams t on t.id = p.team_id where t.coach_id = auth.uid()));

create policy coach_ts_all on training_sessions for all
  using      (team_id in (select id from teams where coach_id = auth.uid()))
  with check (team_id in (select id from teams where coach_id = auth.uid()));

create policy coach_att_all on attendance for all
  using      (session_id in (select ts.id from training_sessions ts join teams t on t.id=ts.team_id where t.coach_id=auth.uid()))
  with check (session_id in (select ts.id from training_sessions ts join teams t on t.id=ts.team_id where t.coach_id=auth.uid()));

create policy coach_match_all on matches for all
  using      (team_id in (select id from teams where coach_id = auth.uid()))
  with check (team_id in (select id from teams where coach_id = auth.uid()));

create policy coach_stats_all on player_match_stats for all
  using      (match_id in (select m.id from matches m join teams t on t.id=m.team_id where t.coach_id=auth.uid()))
  with check (match_id in (select m.id from matches m join teams t on t.id=m.team_id where t.coach_id=auth.uid()));
