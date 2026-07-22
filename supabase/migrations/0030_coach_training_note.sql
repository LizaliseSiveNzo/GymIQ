-- Coach writes a training improvement note for a player -> stored on their profile + notifies them.
create or replace function add_coach_note(p_player_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare v_role user_role; v_user uuid;
begin
  if coalesce(trim(p_note),'') = '' then raise exception 'Note is empty'; end if;
  select role into v_role from users where id = auth.uid();
  if not (v_role = 'admin' or exists (select 1 from players p join teams t on t.id = p.team_id where p.id = p_player_id and t.coach_id = auth.uid())) then
    raise exception 'Not authorised for this player';
  end if;
  insert into coach_player_notes (coach_id, player_id, note) values (auth.uid(), p_player_id, trim(p_note));
  select user_id into v_user from players where id = p_player_id;
  if v_user is not null then
    insert into notifications (user_id, message) values (v_user, '📝 New note from your coach: ' || left(trim(p_note), 140));
  end if;
end; $$;
grant execute on function add_coach_note(uuid, text) to authenticated;
