-- Let a coach upload a document into a player's folder and record it on the player's profile.
drop policy if exists "coach upload player files" on storage.objects;
create policy "coach upload player files" on storage.objects for insert to authenticated
with check (bucket_id='player-files' and (
  (storage.foldername(name))[1] in (select players.id::text from players where players.team_id in (select fn_coach_team_ids()))
  or current_role_of()='admin'));

create or replace function coach_add_player_file(p_player_id uuid, p_path text, p_file_name text, p_mime text, p_kind text)
returns void language plpgsql security definer set search_path = public as $$
declare v_role user_role; v_user uuid; v_file uuid;
begin
  select role into v_role from users where id = auth.uid();
  if not (v_role='admin' or exists (select 1 from players p join teams t on t.id=p.team_id where p.id=p_player_id and t.coach_id=auth.uid())) then
    raise exception 'Not authorised for this player'; end if;
  insert into player_files (player_id, uploaded_by, path, file_name, mime, kind)
  values (p_player_id, auth.uid(), p_path, p_file_name, p_mime, coalesce(nullif(p_kind,''),'document')) returning id into v_file;
  select user_id into v_user from players where id = p_player_id;
  if v_user is not null then
    insert into notifications (user_id, message, ref_type, ref_id)
    values (v_user, '📎 Your coach sent you a document: ' || p_file_name, 'player_file', v_file);
  end if;
end; $$;
grant execute on function coach_add_player_file(uuid, text, text, text, text) to authenticated;
