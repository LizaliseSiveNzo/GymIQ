-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.

-- Phase 1 auth: auto-create profile on signup, self-read, parent child linking

create policy users_read_self   on users for select using (id = auth.uid());
create policy users_update_self on users for update using (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'player')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.link_child(code text)
returns json language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  select id into pid from players where child_code = code;
  if pid is null then
    return json_build_object('ok', false, 'error', 'Invalid child code');
  end if;
  insert into parent_player (parent_user_id, player_id)
  values (auth.uid(), pid)
  on conflict do nothing;
  return json_build_object('ok', true, 'player_id', pid);
end;
$$;

create policy pp_parent_insert on parent_player for insert with check (parent_user_id = auth.uid());
