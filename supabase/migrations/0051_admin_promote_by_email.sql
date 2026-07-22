-- Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
create or replace function public.admin_set_role_by_email(p_email text, p_role user_role)
returns json language plpgsql security definer set search_path to 'public' as $function$
declare v_id uuid; v_name text;
begin
  if current_role_of() <> 'admin' then return json_build_object('ok', false, 'error', 'Admins only'); end if;
  if p_role = 'admin' then return json_build_object('ok', false, 'error', 'Admin role must be granted directly in the database'); end if;
  select id, name into v_id, v_name from users where lower(email) = lower(trim(p_email));
  if v_id is null then return json_build_object('ok', false, 'error', 'No account with that email. Ask them to register first.'); end if;
  update users set role = p_role where id = v_id;
  return json_build_object('ok', true, 'name', v_name, 'role', p_role);
end $function$;
