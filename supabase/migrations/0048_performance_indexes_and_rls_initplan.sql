-- Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.
-- Performance pass: FK covering indexes + RLS initplan rewrites.
-- (Applied to production via Supabase MCP; kept here for the migration record.)

create index if not exists idx_annrec_player       on public.announcement_recipients(player_id);
create index if not exists idx_ann_coach           on public.announcements(coach_id);
create index if not exists idx_att_scanned_by      on public.attendance(scanned_by);
create index if not exists idx_journal_coach       on public.coach_journal_entries(coach_id);
create index if not exists idx_cpn_coach           on public.coach_player_notes(coach_id);
create index if not exists idx_devgoals_coach      on public.development_goals(coach_id);
create index if not exists idx_injuries_created_by on public.injuries(created_by);
create index if not exists idx_lineups_player      on public.match_lineups(player_id);
create index if not exists idx_subs_player_off     on public.match_substitutions(player_off);
create index if not exists idx_subs_player_on      on public.match_substitutions(player_on);
create index if not exists idx_matches_team        on public.matches(team_id);
create index if not exists idx_med_author          on public.medical_notes(author_id);
create index if not exists idx_pah_recorded_by     on public.player_attribute_history(recorded_by);
create index if not exists idx_pfiles_uploaded_by  on public.player_files(uploaded_by);
create index if not exists idx_pms_match           on public.player_match_stats(match_id);
create index if not exists idx_players_user        on public.players(user_id);
create index if not exists idx_tevents_coach       on public.team_events(coach_id);
create index if not exists idx_teams_org           on public.teams(org_id);
create index if not exists idx_ts_coach            on public.training_sessions(coach_id);
create index if not exists idx_ts_team             on public.training_sessions(team_id);
create index if not exists idx_trials_org          on public.trials(org_id);
create index if not exists idx_users_org           on public.users(org_id);

alter policy coach_manage_notes on public.coach_player_notes
  using ((select current_role_of()) = 'coach'::user_role and coach_id = (select auth.uid()));
alter policy player_read_self on public.players using (user_id = (select auth.uid()));
alter policy notif_own on public.notifications using (user_id = (select auth.uid()));
alter policy org_read_member on public.organisations
  using (id = (select u.org_id from users u where u.id = (select auth.uid())));
alter policy users_read_self on public.users using (id = (select auth.uid()));
alter policy users_update_self on public.users using (id = (select auth.uid()));
alter policy coach_read_teams on public.teams using (coach_id = (select auth.uid()));
alter policy med_read on public.medical_notes
  using ((select current_role_of()) = 'admin'::user_role
      or player_id in (select p.id from players p where p.user_id = (select auth.uid()))
      or player_id in (select p.id from players p where p.team_id in (select fn_coach_team_ids())));
alter policy med_insert on public.medical_notes
  with check (author_id = (select auth.uid())
      and ((select current_role_of()) = 'admin'::user_role
        or player_id in (select p.id from players p where p.user_id = (select auth.uid()))
        or player_id in (select p.id from players p where p.team_id in (select fn_coach_team_ids()))));
alter policy pf_delete on public.player_files
  using ((select current_role_of()) = 'admin'::user_role
      or player_id in (select p.id from players p where p.user_id = (select auth.uid())));
alter policy pf_read on public.player_files
  using ((select current_role_of()) = 'admin'::user_role
      or player_id in (select p.id from players p where p.user_id = (select auth.uid()))
      or player_id in (select p.id from players p where p.team_id in (select fn_coach_team_ids())));
alter policy pf_insert on public.player_files
  with check (uploaded_by = (select auth.uid())
      and player_id in (select p.id from players p where p.user_id = (select auth.uid())));
alter policy pa_read on public.player_attributes
  using ((select current_role_of()) = 'admin'::user_role
      or player_id in (select p.id from players p where p.user_id = (select auth.uid()))
      or player_id in (select p.id from players p where p.team_id in (select fn_coach_team_ids())));
