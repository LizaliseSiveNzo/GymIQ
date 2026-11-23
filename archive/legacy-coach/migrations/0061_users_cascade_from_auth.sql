-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.

-- 0061: Cascade profile deletion from auth.
-- public.users.id mirrors auth.users.id (set by the handle_new_user trigger) but
-- had no foreign key, so deleting a user in the Supabase Auth dashboard left an
-- orphaned public.users row. Because email is unique there, re-registering the
-- same address then failed with "Database error saving new user" (surfaced as an
-- empty error in the UI). This FK makes an auth-user deletion clean up the
-- profile automatically. (Existing orphans were removed before adding it.)

alter table public.users
  drop constraint if exists users_id_fkey;

alter table public.users
  add constraint users_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;
