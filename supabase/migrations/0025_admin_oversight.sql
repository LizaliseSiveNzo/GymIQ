-- Admin oversight: training logs & matches, edit attendance, all player stats, coach directory, bulk announcements.
create or replace function _require_admin_org()
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_role user_role;
begin
  select role, org_id into v_role, v_org from users where id = auth.uid();
  if v_role is null or v_role <> 'admin' then raise exception 'Admins only'; end if;
  return v_org;
end; $$;

create or replace function admin_training_log()
returns table(session_id uuid, team_id uuid, team_name text, when_at timestamptz, notes text, present int, total int)
language plpgsql security definer set search_path = public as $$
declare v_org uuid; begin
  v_org := _require_admin_org();
  return query
  select ts.id, ts.team_id, tm.name, coalesce(ts.starts_at, ts.date::timestamptz), ts.notes,
    (select count(*)::int from attendance a where a.session_id = ts.id and a.attended),
    (select count(*)::int from players p where p.team_id = ts.team_id)
  from training_sessions ts join teams tm on tm.id = ts.team_id
  where tm.org_id = v_org order by coalesce(ts.starts_at, ts.date::timestamptz) desc;
end; $$;

create or replace function admin_matches()
returns table(match_id uuid, team_id uuid, team_name text, opponent text, when_at timestamptz, venue text, result text, formation text)
language plpgsql security definer set search_path = public as $$
declare v_org uuid; begin
  v_org := _require_admin_org();
  return query
  select m.id, m.team_id, tm.name, m.opponent, m.date, m.venue, m.result, m.formation
  from matches m join teams tm on tm.id = m.team_id where tm.org_id = v_org order by m.date desc;
end; $$;

create or replace function admin_set_attendance(p_session_id uuid, p_player_id uuid, p_present boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_team uuid; begin
  v_org := _require_admin_org();
  select ts.team_id into v_team from training_sessions ts join teams tm on tm.id = ts.team_id
  where ts.id = p_session_id and tm.org_id = v_org;
  if v_team is null then raise exception 'Session not in your academy'; end if;
  insert into attendance (session_id, player_id, attended, method, scanned_by)
  values (p_session_id, p_player_id, p_present, 'override', auth.uid())
  on conflict (session_id, player_id) do update set attended = excluded.attended, method = 'override', scanned_by = auth.uid();
  perform recompute_team_ranks(v_team);
end; $$;

create or replace function admin_player_stats()
returns table(player_id uuid, name text, email text, team_name text, play_position text, rank_level text,
              attendance_pct int, minutes int, games int, avg_rating numeric)
language plpgsql security definer set search_path = public as $$
declare v_org uuid; begin
  v_org := _require_admin_org();
  return query
  select p.id, u.name, u.email, tm.name, p.position, p.rank_level::text,
    case when ts.total > 0 then round(100.0 * coalesce(att.n,0) / ts.total)::int else 0 end,
    coalesce(st.minutes,0)::int, coalesce(st.games,0)::int, coalesce(round(st.avg_rating,1),0)
  from players p join users u on u.id = p.user_id join teams tm on tm.id = p.team_id
  left join lateral (select count(*) total from training_sessions s where s.team_id = p.team_id) ts on true
  left join lateral (select count(*) n from attendance a where a.player_id = p.id and a.attended) att on true
  left join lateral (select sum(minutes_played) minutes, count(*) games, avg(rating) avg_rating from player_match_stats pms where pms.player_id = p.id) st on true
  where tm.org_id = v_org order by u.name;
end; $$;

create or replace function admin_coaches()
returns table(coach_id uuid, name text, email text, teams text[], team_count int, player_count int, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_org uuid; begin
  v_org := _require_admin_org();
  return query
  select u.id, u.name, u.email,
    array(select tm.name from teams tm where tm.coach_id = u.id and tm.org_id = v_org order by tm.name),
    (select count(*)::int from teams tm where tm.coach_id = u.id and tm.org_id = v_org),
    (select count(*)::int from players p join teams tm on tm.id = p.team_id where tm.coach_id = u.id and tm.org_id = v_org),
    u.created_at
  from users u
  where u.role = 'coach' and (u.org_id = v_org or exists (select 1 from teams tm where tm.coach_id = u.id and tm.org_id = v_org))
  order by u.name;
end; $$;

create or replace function admin_broadcast(p_audience text, p_title text, p_message text)
returns int language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_roles user_role[]; v_count int; v_body text; begin
  v_org := _require_admin_org();
  if coalesce(trim(p_message),'') = '' then raise exception 'Message is required'; end if;
  v_roles := case p_audience when 'players' then array['player']::user_role[]
             when 'coaches' then array['coach']::user_role[] else array['player','coach']::user_role[] end;
  v_body := case when coalesce(trim(p_title),'') <> '' then '📣 ' || trim(p_title) || ' — ' || trim(p_message) else '📣 ' || trim(p_message) end;
  insert into notifications (user_id, message)
  select u.id, v_body from users u
  where u.role = any(v_roles) and (u.org_id = v_org
    or exists (select 1 from players p join teams tm on tm.id = p.team_id where p.user_id = u.id and tm.org_id = v_org)
    or exists (select 1 from teams tm where tm.coach_id = u.id and tm.org_id = v_org));
  get diagnostics v_count = row_count;
  return v_count;
end; $$;

grant execute on function admin_training_log() to authenticated;
grant execute on function admin_matches() to authenticated;
grant execute on function admin_set_attendance(uuid, uuid, boolean) to authenticated;
grant execute on function admin_player_stats() to authenticated;
grant execute on function admin_coaches() to authenticated;
grant execute on function admin_broadcast(text, text, text) to authenticated;
