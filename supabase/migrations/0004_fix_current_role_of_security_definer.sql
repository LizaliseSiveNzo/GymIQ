-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.

-- Prevent RLS recursion: current_role_of() reads users, and users' admin policy
-- calls current_role_of(). SECURITY DEFINER makes it bypass RLS when reading the role.
create or replace function current_role_of()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from users where id = auth.uid()
$$;
