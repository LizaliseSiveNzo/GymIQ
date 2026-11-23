-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.

-- 0059: Manual trainer→client linking by email.
-- Invite codes (Phase 1c) are the self-serve path; this RPC is the manual one a
-- trainer uses to add a client who already has a Customer account. SECURITY
-- DEFINER so it can look up a user by email (normal RLS would hide non-clients).

create or replace function trainer_add_client_by_email(p_email text)
returns json language plpgsql security definer set search_path = public as $$
declare v_role user_role; v_client users;
begin
  select role into v_role from users where id = auth.uid();
  if v_role is null or v_role <> 'coach' then
    return json_build_object('ok', false, 'error', 'Only trainers can add clients.');
  end if;

  select * into v_client from users
   where lower(email) = lower(trim(p_email)) and role = 'player'
   limit 1;

  if v_client.id is null then
    return json_build_object('ok', false,
      'error', 'No client account with that email. Ask them to sign up as a Customer first.');
  end if;

  insert into trainer_clients (trainer_id, client_id, status)
  values (auth.uid(), v_client.id, 'active')
  on conflict (trainer_id, client_id) do update set status = 'active';

  return json_build_object('ok', true, 'client_id', v_client.id, 'name', v_client.name);
end $$;

revoke execute on function trainer_add_client_by_email(text) from public, anon;
grant execute on function trainer_add_client_by_email(text) to authenticated;
