-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.
-- Journal entries on the calendar + general-purpose team events

alter table public.coach_journal_entries
  add column if not exists show_on_calendar boolean not null default true;

create table if not exists public.team_events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  coach_id uuid references public.users(id) on delete set null,
  title text not null,
  event_type text not null default 'Other'
    check (event_type in ('Meeting','Trial','Fitness test','Social','Tournament','Other')),
  starts_at timestamptz not null, location text, notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_team_events_team on public.team_events(team_id, starts_at desc);
alter table public.team_events enable row level security;
drop policy if exists events_coach on public.team_events;
create policy events_coach on public.team_events for all
  using (team_id in (select fn_coach_team_ids())) with check (team_id in (select fn_coach_team_ids()));
drop policy if exists events_player_read on public.team_events;
create policy events_player_read on public.team_events for select using (team_id = fn_my_team_id());
drop policy if exists events_admin on public.team_events;
create policy events_admin on public.team_events for all using (current_role_of() = 'admin');

create or replace function public.delete_team_event(p_id uuid)
returns json language plpgsql security definer set search_path to 'public' as $function$
declare v_team uuid; v_title text; v_when timestamptz;
begin
  select team_id, title, starts_at into v_team, v_title, v_when from team_events where id = p_id;
  if v_team is null then return json_build_object('ok', false, 'error', 'Event not found'); end if;
  if not (current_role_of() = 'admin'
          or exists (select 1 from teams where id = v_team and coach_id = auth.uid())) then
    return json_build_object('ok', false, 'error', 'Not authorized for this team');
  end if;
  delete from notifications where ref_type = 'event' and ref_id = p_id;
  insert into notifications (user_id, message, ref_type, ref_id)
    select p.user_id, 'Cancelled: ' || v_title || ' — ' || to_char(v_when, 'Dy DD Mon HH24:MI'), 'event_cancelled', p_id
    from players p where p.team_id = v_team and p.user_id is not null;
  delete from team_events where id = p_id;
  return json_build_object('ok', true);
end $function$;
revoke execute on function public.delete_team_event(uuid) from anon;
