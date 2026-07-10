-- Coach/admin can delete a logged training session (attendance cascades), then ranks recompute.
create or replace function delete_training_session(p_session_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_team uuid; v_role user_role; v_coach uuid;
begin
  select ts.team_id, t.coach_id into v_team, v_coach
  from training_sessions ts join teams t on t.id = ts.team_id where ts.id = p_session_id;
  if v_team is null then raise exception 'Session not found'; end if;
  select role into v_role from users where id = auth.uid();
  if not (v_role = 'admin' or v_coach = auth.uid()
          or exists (select 1 from training_sessions s where s.id = p_session_id and s.coach_id = auth.uid())) then
    raise exception 'Not authorised to delete this session';
  end if;
  delete from training_sessions where id = p_session_id;
  perform recompute_team_ranks(v_team);
end; $$;
grant execute on function delete_training_session(uuid) to authenticated;
