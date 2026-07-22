-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.

-- GymIQ — Enable RLS on remaining tables (security hardening)
-- organisations, parent_player, trials were exposed to the anon key.
-- Public trial lookups still work: the backend uses the service-role key (bypasses RLS).

alter table organisations enable row level security;
alter table parent_player enable row level security;
alter table trials        enable row level security;

create policy org_admin_all   on organisations for all using (current_role_of() = 'admin');
create policy org_read_member on organisations for select using (
  id = (select org_id from users where id = auth.uid())
);

create policy pp_parent_read on parent_player for select using (parent_user_id = auth.uid());
create policy pp_admin_all   on parent_player for all using (current_role_of() = 'admin');

create policy trials_staff_read on trials for select using (current_role_of() in ('admin','coach'));
create policy trials_admin_all  on trials for all using (current_role_of() = 'admin');
