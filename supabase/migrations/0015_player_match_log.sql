-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.

-- Per-game minutes / stats log for a player (authz: the player, their coach, or admin)
create or replace function player_match_log(p_player uuid default null)
returns json language plpgsql stable security definer set search_path = public as $$
declare target uuid; tid uuid; ok boolean;
begin
  target := coalesce(p_player, (select id from players where user_id = auth.uid() limit 1));
  if target is null then return '[]'::json; end if;
  select team_id into tid from players where id = target;
  ok := exists (select 1 from players where id = target and user_id = auth.uid())
     or current_role_of() = 'admin'
     or exists (select 1 from teams where id = tid and coach_id = auth.uid());
  if not ok then return '[]'::json; end if;
  return coalesce((select json_agg(x) from (
      select m.opponent, m.date, m.venue, m.result,
             s.minutes_played, s.goals, s.assists, s.rating
      from player_match_stats s join matches m on m.id = s.match_id
      where s.player_id = target
      order by m.date desc) x), '[]'::json);
end; $$;
