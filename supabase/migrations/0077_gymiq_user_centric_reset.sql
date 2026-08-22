-- 0077_gymiq_user_centric_reset
-- Rebuild on the Aster Supabase project as a USER-CENTRIC app (coaching shelved,
-- to be re-added later). Drops football-era tables, makes every account a
-- self-directed user, and recreates notifications as user-owned.
-- Applied to project brnshmmsyfitmotauaud.

drop table if exists
  attendance, player_match_stats, match_lineups, match_substitutions, match_interviews,
  match_highlights, matches, training_standouts, training_sessions, player_attribute_history,
  player_attributes, development_milestones, development_goals, injuries, medical_notes,
  player_files, player_guardians, document_consents, assessment_responses, coach_player_notes,
  coach_journal_entries, team_events, event_rsvps, announcement_recipients, announcements,
  trial_registrations, trials, players, teams, organisations, email_debug, notifications
  cascade;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_consent boolean; v_requested text; v_role user_role;
begin
  v_consent   := coalesce((new.raw_user_meta_data->>'consent')::boolean, false);
  v_requested := lower(coalesce(new.raw_user_meta_data->>'role', 'player'));
  v_role := case v_requested when 'coach' then 'coach'::user_role when 'trainer' then 'coach'::user_role else 'player'::user_role end;
  insert into public.users (id, email, name, role, consent_version, consent_accepted_at)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
          v_role, nullif(new.raw_user_meta_data->>'consent_version',''),
          case when v_consent then now() else null end);
  return new;
end $$;

alter table public.users enable row level security;
drop policy if exists users_self_read on public.users;
drop policy if exists users_self_write on public.users;
create policy users_self_read on public.users for select using (id = auth.uid());
create policy users_self_write on public.users for update using (id = auth.uid()) with check (id = auth.uid());
grant select, update on public.users to authenticated;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text, body text, kind text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_notif_user on public.notifications(user_id, read);
alter table public.notifications enable row level security;
create policy notif_owner_all on public.notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.notifications to authenticated;
