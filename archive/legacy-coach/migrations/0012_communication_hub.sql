-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.

-- 0012: Communication hub.
-- 1) Announcements (coach -> team)  2) RSVP / absence reporting
-- 3) Auto notifications on schedule changes  4) Players read own notes/meal plan
-- 5) Retire the parent role: parents share the child's Player login.

-- ---------- helper fns (security definer to avoid RLS recursion) ----------
create or replace function fn_my_player_ids() returns setof uuid
language sql stable security definer set search_path=public as
$$ select id from players where user_id = auth.uid() $$;

create or replace function fn_coach_player_ids() returns setof uuid
language sql stable security definer set search_path=public as
$$ select p.id from players p where p.team_id in (select id from teams where coach_id = auth.uid()) $$;

-- ---------- 1) announcements ----------
create table if not exists announcements (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references teams(id) on delete cascade,
  coach_id   uuid references users(id) on delete set null,
  title      text not null,
  body       text,
  created_at timestamptz default now()
);
create index if not exists idx_ann_team on announcements(team_id, created_at desc);
alter table announcements enable row level security;

create policy admin_all_ann on announcements for all using (current_role_of() = 'admin');
create policy coach_ann_all on announcements for all
  using      (team_id in (select fn_coach_team_ids()))
  with check (team_id in (select fn_coach_team_ids()));
create policy player_read_ann on announcements for select using (team_id = fn_my_team_id());

-- ---------- 2) RSVP / absence ----------
do $$ begin
  create type rsvp_status as enum ('going','absent');
exception when duplicate_object then null; end $$;

create table if not exists event_rsvps (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references players(id) on delete cascade,
  event_type text not null check (event_type in ('practice','match')),
  event_id   uuid not null,
  status     rsvp_status not null,
  reason     text,
  updated_at timestamptz default now(),
  unique (player_id, event_type, event_id)
);
create index if not exists idx_rsvp_event on event_rsvps(event_type, event_id);
alter table event_rsvps enable row level security;

create policy admin_all_rsvp on event_rsvps for all using (current_role_of() = 'admin');
create policy player_rsvp_own on event_rsvps for all
  using      (player_id in (select fn_my_player_ids()))
  with check (player_id in (select fn_my_player_ids()));
create policy coach_read_rsvp on event_rsvps for select
  using (player_id in (select fn_coach_player_ids()));

-- ---------- 3) auto notifications when schedule changes ----------
create or replace function tg_notify_practice_change() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if (new.starts_at is distinct from old.starts_at) or (new.location is distinct from old.location) then
    insert into notifications (user_id, message)
    select p.user_id,
           'Practice updated: ' || coalesce(to_char(new.starts_at, 'Dy DD Mon HH24:MI'), new.date::text)
           || coalesce(' at ' || new.location, '')
    from players p where p.team_id = new.team_id and p.user_id is not null;
  end if;
  return new;
end $$;
drop trigger if exists trg_practice_change on training_sessions;
create trigger trg_practice_change after update on training_sessions
  for each row execute function tg_notify_practice_change();

create or replace function tg_notify_match_change() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if (new.date is distinct from old.date) or (new.venue is distinct from old.venue)
     or (new.opponent is distinct from old.opponent) then
    insert into notifications (user_id, message)
    select p.user_id,
           'Fixture updated: vs ' || new.opponent || ' — ' || to_char(new.date, 'Dy DD Mon HH24:MI')
           || coalesce(' (' || new.venue || ')', '')
    from players p where p.team_id = new.team_id and p.user_id is not null;
  end if;
  return new;
end $$;
drop trigger if exists trg_match_change on matches;
create trigger trg_match_change after update on matches
  for each row execute function tg_notify_match_change();

-- ---------- 4) players read their own coach notes / meal plan ----------
drop policy if exists player_read_own_notes on coach_player_notes;
create policy player_read_own_notes on coach_player_notes for select
  using (player_id in (select fn_my_player_ids()));

-- ---------- 5) retire the parent role ----------
drop policy if exists parent_read_child      on players;
drop policy if exists parent_read_stats      on player_match_stats;
drop policy if exists parent_read_notes      on coach_player_notes;
drop policy if exists parent_read_child_team on teams;
drop policy if exists parent_read_matches    on matches;
drop policy if exists parent_read_ts         on training_sessions;
drop policy if exists pp_parent_insert       on parent_player;
drop function if exists link_child(text);
drop function if exists fn_child_team_ids();
drop function if exists fn_child_player_ids();
drop table if exists parent_player;

-- any existing parent accounts become player accounts (they log in via the child's profile)
update users set role = 'player' where role = 'parent';

-- signups can no longer create parent accounts (coerced to player)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_role user_role;
begin
  v_role := coalesce((new.raw_user_meta_data->>'role')::user_role, 'player');
  if v_role = 'parent' then v_role := 'player'; end if;
  insert into public.users (id, email, name, role)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
          v_role);
  return new;
end $$;

-- notify_team now targets players only
create or replace function public.notify_team(p_team uuid, p_message text)
returns json language plpgsql security definer set search_path = public as $$
declare player_ct int := 0;
begin
  if not (current_role_of() = 'admin' or exists (select 1 from teams where id = p_team and coach_id = auth.uid())) then
    return json_build_object('ok', false, 'error', 'Not authorized for this team');
  end if;
  insert into notifications (user_id, message)
    select p.user_id, p_message from players p where p.team_id = p_team and p.user_id is not null;
  get diagnostics player_ct = row_count;
  return json_build_object('ok', true, 'players', player_ct);
end $$;
