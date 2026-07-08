-- Let a coach create their own team (becomes its coach). Resolves/creates an org if needed.
create or replace function create_coach_team(p_name text, p_division text, p_sport text default 'soccer')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_team uuid; v_role user_role; v_name text;
begin
  select role, org_id, name into v_role, v_org, v_name from users where id = auth.uid();
  if v_role is null or v_role not in ('coach','admin') then raise exception 'Only coaches or admins can create teams'; end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'Team name is required'; end if;
  if v_org is null then
    v_org := (select id from organisations order by created_at limit 1);
    if v_org is null then insert into organisations (name) values (coalesce(v_name,'PitchIQ') || '''s Academy') returning id into v_org; end if;
    update users set org_id = v_org where id = auth.uid();
  end if;
  insert into teams (org_id, name, division, sport, coach_id)
  values (v_org, p_name, p_division::division_level, coalesce(nullif(p_sport,''),'soccer'), auth.uid())
  returning id into v_team;
  return v_team;
end; $$;
