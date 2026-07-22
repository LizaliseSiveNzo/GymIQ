-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.

-- Practice scheduling: training sessions get a time + location; players/parents read their team's sessions
alter table training_sessions add column if not exists starts_at timestamptz;
alter table training_sessions add column if not exists location text;

create policy player_read_ts on training_sessions for select using (team_id = fn_my_team_id());
create policy parent_read_ts on training_sessions for select using (team_id in (select fn_child_team_ids()));
