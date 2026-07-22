-- Reliable coach/admin deletion so items disappear from players' views too.
create or replace function delete_announcement(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_team uuid; v_role user_role; v_path text;
begin
  select a.team_id, a.file_path into v_team, v_path from announcements a where a.id = p_id;
  if v_team is null then return; end if;
  select role into v_role from users where id = auth.uid();
  if not (v_role = 'admin' or exists (select 1 from teams t where t.id = v_team and t.coach_id = auth.uid())) then
    raise exception 'Not authorised for this announcement'; end if;
  if v_path is not null then delete from storage.objects where bucket_id = 'announcement-files' and name = v_path; end if;
  delete from announcements where id = p_id;
end; $$;

create or replace function delete_match(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_team uuid; v_role user_role;
begin
  select team_id into v_team from matches where id = p_id;
  if v_team is null then return; end if;
  select role into v_role from users where id = auth.uid();
  if not (v_role = 'admin' or exists (select 1 from teams t where t.id = v_team and t.coach_id = auth.uid())) then
    raise exception 'Not authorised for this match'; end if;
  delete from match_lineups where match_id = p_id;
  delete from player_match_stats where match_id = p_id;
  delete from event_rsvps where event_type = 'match' and event_id = p_id;
  delete from matches where id = p_id;
end; $$;

grant execute on function delete_announcement(uuid) to authenticated;
grant execute on function delete_match(uuid) to authenticated;
