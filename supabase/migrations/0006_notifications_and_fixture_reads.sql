-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.

-- Phase 4: schedule + notifications (see also 0007 recursion fix)
create or replace function public.notify_team(p_team uuid, p_message text)
returns json language plpgsql security definer set search_path = public as $$
declare player_ct int := 0; parent_ct int := 0;
begin
  if not (current_role_of() = 'admin' or exists (select 1 from teams where id = p_team and coach_id = auth.uid())) then
    return json_build_object('ok', false, 'error', 'Not authorized for this team');
  end if;
  insert into notifications (user_id, message)
    select p.user_id, p_message from players p where p.team_id = p_team and p.user_id is not null;
  get diagnostics player_ct = row_count;
  insert into notifications (user_id, message)
    select distinct pp.parent_user_id, p_message from players p join parent_player pp on pp.player_id = p.id where p.team_id = p_team;
  get diagnostics parent_ct = row_count;
  return json_build_object('ok', true, 'players', player_ct, 'parents', parent_ct);
end; $$;
