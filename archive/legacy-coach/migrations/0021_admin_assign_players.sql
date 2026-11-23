-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.

-- Admin: list every player registration (incl. self-signups with no player row yet) + assign to a team.
create or replace function admin_list_players()
returns table(user_id uuid, player_id uuid, name text, email text, team_id uuid, team_name text, play_position text, rank_level text, child_code text, needs_team boolean)
language sql security definer set search_path = public as $$
  select u.id, p.id, u.name, u.email, p.team_id, t.name, p.position, p.rank_level::text, p.child_code,
         (p.id is null or p.team_id is null) as needs_team
  from users u
  left join players p on p.user_id = u.id
  left join teams t on t.id = p.team_id
  where u.role = 'player'
    and exists (select 1 from users me where me.id = auth.uid() and me.role = 'admin')
  order by (p.id is null or p.team_id is null) desc, u.created_at desc;
$$;

create or replace function admin_assign_player(p_user_id uuid, p_team_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_role user_role; v_player uuid; v_code text; v_team_org uuid;
begin
  select role into v_role from users where id = auth.uid();
  if v_role is null or v_role <> 'admin' then raise exception 'Only admins can assign players'; end if;
  select org_id into v_team_org from teams where id = p_team_id;
  if v_team_org is null then raise exception 'Team not found'; end if;
  select id into v_player from players where user_id = p_user_id;
  if v_player is null then
    v_code := 'PIQ-' || upper(substring(md5(random()::text) from 1 for 5));
    insert into players (user_id, team_id, child_code) values (p_user_id, p_team_id, v_code) returning id into v_player;
  else
    update players set team_id = p_team_id where id = v_player;
  end if;
  update users set org_id = coalesce(org_id, v_team_org) where id = p_user_id;
  return v_player;
end; $$;

grant execute on function admin_list_players() to authenticated;
grant execute on function admin_assign_player(uuid, uuid) to authenticated;
