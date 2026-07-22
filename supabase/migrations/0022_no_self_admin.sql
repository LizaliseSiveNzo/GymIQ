-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.

-- Block self-registration as admin. Any signup requesting 'admin' is downgraded to 'coach'.
-- Admins can only be granted directly in the database.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare v_role user_role;
begin
  v_role := coalesce((new.raw_user_meta_data->>'role')::user_role, 'player');
  if v_role = 'parent' then v_role := 'player'; end if;
  if v_role = 'admin' then v_role := 'coach'; end if;
  insert into public.users (id, email, name, role)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
          v_role);
  return new;
end $function$;
