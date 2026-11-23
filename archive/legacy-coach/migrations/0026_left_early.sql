-- Replace "check out" with "left early + reason".
alter table public.attendance add column if not exists left_early boolean not null default false;
alter table public.attendance add column if not exists left_reason text;

drop function if exists session_attendance(uuid);
create function session_attendance(p_session_id uuid)
returns table(player_id uuid, name text, child_code text, present boolean, checkin_at timestamptz,
              left_early boolean, left_reason text, method text)
language plpgsql security definer set search_path = public as $$
declare v_team uuid; v_role user_role; v_coach uuid;
begin
  select ts.team_id, t.coach_id into v_team, v_coach from training_sessions ts join teams t on t.id = ts.team_id where ts.id = p_session_id;
  if v_team is null then raise exception 'Session not found'; end if;
  select role into v_role from users where id = auth.uid();
  if not (v_role = 'admin' or v_coach = auth.uid() or exists (select 1 from training_sessions s where s.id = p_session_id and s.coach_id = auth.uid())) then
    raise exception 'Not authorised for this session'; end if;
  return query
  select p.id, u.name, p.child_code, coalesce(a.attended, false), a.checkin_at,
         coalesce(a.left_early, false), a.left_reason, a.method
  from players p join users u on u.id = p.user_id
  left join attendance a on a.player_id = p.id and a.session_id = p_session_id
  where p.team_id = v_team order by (a.checkin_at is not null) desc, u.name;
end; $$;

create or replace function record_left_early(p_session_id uuid, p_player_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_team uuid; v_role user_role; v_coach uuid;
begin
  select ts.team_id, t.coach_id into v_team, v_coach from training_sessions ts join teams t on t.id = ts.team_id where ts.id = p_session_id;
  if v_team is null then raise exception 'Session not found'; end if;
  select role into v_role from users where id = auth.uid();
  if not (v_role = 'admin' or v_coach = auth.uid() or exists (select 1 from training_sessions s where s.id = p_session_id and s.coach_id = auth.uid())) then
    raise exception 'Not authorised for this session'; end if;
  insert into attendance (session_id, player_id, attended, checkin_at, left_early, left_reason, method, scanned_by)
  values (p_session_id, p_player_id, true, now(), true, nullif(trim(p_reason),''), 'manual', auth.uid())
  on conflict (session_id, player_id) do update
    set attended = true, checkin_at = coalesce(attendance.checkin_at, now()),
        left_early = true, left_reason = nullif(trim(p_reason),''), scanned_by = auth.uid();
end; $$;

create or replace function clear_left_early(p_session_id uuid, p_player_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_role user_role; v_coach uuid; v_team uuid;
begin
  select ts.team_id, t.coach_id into v_team, v_coach from training_sessions ts join teams t on t.id = ts.team_id where ts.id = p_session_id;
  if v_team is null then raise exception 'Session not found'; end if;
  select role into v_role from users where id = auth.uid();
  if not (v_role = 'admin' or v_coach = auth.uid() or exists (select 1 from training_sessions s where s.id = p_session_id and s.coach_id = auth.uid())) then
    raise exception 'Not authorised for this session'; end if;
  update attendance set left_early = false, left_reason = null where session_id = p_session_id and player_id = p_player_id;
end; $$;

grant execute on function session_attendance(uuid) to authenticated;
grant execute on function record_left_early(uuid, uuid, text) to authenticated;
grant execute on function clear_left_early(uuid, uuid) to authenticated;
