-- QR / code-based practice attendance with server-set timestamps + audit.
alter table public.attendance add column if not exists checkin_at  timestamptz;
alter table public.attendance add column if not exists checkout_at timestamptz;
alter table public.attendance add column if not exists method      text;
alter table public.attendance add column if not exists scanned_by  uuid references public.users(id);

create or replace function my_player_code()
returns table(name text, child_code text)
language sql security definer set search_path = public as $$
  select u.name, p.child_code from players p join users u on u.id = p.user_id
  where p.user_id = auth.uid() limit 1;
$$;

create or replace function session_attendance(p_session_id uuid)
returns table(player_id uuid, name text, child_code text, present boolean, checkin_at timestamptz, checkout_at timestamptz, method text)
language plpgsql security definer set search_path = public as $$
declare v_team uuid; v_role user_role; v_coach uuid;
begin
  select ts.team_id, t.coach_id into v_team, v_coach from training_sessions ts join teams t on t.id = ts.team_id where ts.id = p_session_id;
  if v_team is null then raise exception 'Session not found'; end if;
  select role into v_role from users where id = auth.uid();
  if not (v_role = 'admin' or v_coach = auth.uid() or exists (select 1 from training_sessions s where s.id = p_session_id and s.coach_id = auth.uid())) then
    raise exception 'Not authorised for this session'; end if;
  return query
  select p.id, u.name, p.child_code, coalesce(a.attended, false), a.checkin_at, a.checkout_at, a.method
  from players p join users u on u.id = p.user_id
  left join attendance a on a.player_id = p.id and a.session_id = p_session_id
  where p.team_id = v_team order by (a.checkin_at is not null) desc, u.name;
end; $$;

create or replace function record_attendance(p_session_id uuid, p_code text, p_action text default 'in', p_method text default 'qr')
returns json language plpgsql security definer set search_path = public as $$
declare v_team uuid; v_coach uuid; v_role user_role; v_player uuid; v_name text;
        v_checkin timestamptz; v_checkout timestamptz; v_method text; v_att boolean;
begin
  select ts.team_id, t.coach_id into v_team, v_coach from training_sessions ts join teams t on t.id = ts.team_id where ts.id = p_session_id;
  if v_team is null then raise exception 'Session not found'; end if;
  select role into v_role from users where id = auth.uid();
  if not (v_role = 'admin' or v_coach = auth.uid() or exists (select 1 from training_sessions s where s.id = p_session_id and s.coach_id = auth.uid())) then
    raise exception 'Not authorised for this session'; end if;
  select p.id, u.name into v_player, v_name from players p join users u on u.id = p.user_id
  where p.team_id = v_team and upper(trim(p.child_code)) = upper(trim(p_code)) limit 1;
  if v_player is null then raise exception 'No player with code % on this team', p_code; end if;
  v_method := case when p_method in ('qr','manual','override') then p_method else 'qr' end;
  insert into attendance (session_id, player_id, attended, checkin_at, checkout_at, method, scanned_by)
  values (p_session_id, v_player, true, now(), case when p_action = 'out' then now() else null end, v_method, auth.uid())
  on conflict (session_id, player_id) do update
    set attended = true, checkin_at = coalesce(attendance.checkin_at, now()),
        checkout_at = case when p_action = 'out' then now() else attendance.checkout_at end,
        method = v_method, scanned_by = auth.uid();
  select attended, checkin_at, checkout_at, method into v_att, v_checkin, v_checkout
  from attendance where session_id = p_session_id and player_id = v_player;
  return json_build_object('player_id', v_player, 'name', v_name, 'action', p_action,
    'checkin_at', v_checkin, 'checkout_at', v_checkout, 'method', v_method,
    'minutes', case when v_checkin is not null and v_checkout is not null then round(extract(epoch from (v_checkout - v_checkin))/60)::int else null end);
end; $$;

grant execute on function my_player_code() to authenticated;
grant execute on function session_attendance(uuid) to authenticated;
grant execute on function record_attendance(uuid, text, text, text) to authenticated;
