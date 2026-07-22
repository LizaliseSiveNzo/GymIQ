-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.

-- Phase 7: gather a player's recent data for the AI summary (authz self/coach/admin)
create or replace function player_ai_context(p_player uuid default null)
returns json language plpgsql stable security definer set search_path = public as $$
declare target uuid; tid uuid; pname text; pos text; team_name text; ok boolean;
begin
  target := coalesce(p_player, (select id from players where user_id = auth.uid() limit 1));
  if target is null then return null; end if;
  select p.team_id, u.name, p.position into tid, pname, pos
    from players p join users u on u.id = p.user_id where p.id = target;
  ok := exists (select 1 from players where id = target and user_id = auth.uid())
     or current_role_of() = 'admin'
     or exists (select 1 from teams where id = tid and coach_id = auth.uid());
  if not ok then return null; end if;
  select name into team_name from teams where id = tid;
  return json_build_object(
    'name', pname, 'position', pos, 'team', team_name,
    'attendance', coalesce((select json_agg(x) from (
        select ts.date, a.attended from attendance a join training_sessions ts on ts.id = a.session_id
        where a.player_id = target order by ts.date desc limit 5) x), '[]'::json),
    'matches', coalesce((select json_agg(x) from (
        select m.opponent, m.date, s.minutes_played, s.goals, s.assists, s.rating
        from player_match_stats s join matches m on m.id = s.match_id
        where s.player_id = target order by m.date desc limit 3) x), '[]'::json),
    'notes', coalesce((select json_agg(x) from (
        select note, diet_plan, created_at from coach_player_notes
        where player_id = target order by created_at desc limit 3) x), '[]'::json),
    'stats', json_build_object('score', player_score(target),
        'rank', (select rank_level from players where id = target)));
end; $$;
