-- Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
-- Postgres grants EXECUTE to PUBLIC by default, so revoking from anon/authenticated
-- alone is a no-op. Revoke from PUBLIC, then grant back only what is needed.
-- NOTE: fn_* and current_role_of() are referenced inside RLS policies and MUST
-- stay executable by anon + authenticated or every query fails.
do $$
declare
  client_rpcs text[] := array[
    'add_coach_note','admin_assign_player','admin_broadcast','admin_coach_announcements',
    'admin_coach_dossier','admin_coach_upcoming','admin_coaches','admin_list_players',
    'admin_matches','admin_player_attendance','admin_player_dossier','admin_player_files',
    'admin_player_matches','admin_player_medical','admin_player_notes','admin_player_stats',
    'admin_set_attendance','admin_training_log','admin_set_role','admin_set_role_by_email',
    'clear_left_early','coach_add_player_file','create_coach_team','delete_announcement',
    'delete_match','delete_team','delete_team_event','delete_training_session',
    'link_child','match_lineup','my_announcements','my_player_code','my_player_overview',
    'notify_team','player_ai_context','player_card','player_match_log','record_attendance',
    'recompute_team_ranks','record_left_early','send_announcement','session_attendance',
    'set_announcement_pinned','set_trial_outcome','stat_leaderboard','team_leaderboard',
    'update_announcement','weekly_highlights'];
  policy_helpers text[] := array['current_role_of','fn_coach_player_ids','fn_coach_player_user_ids',
    'fn_coach_team_ids','fn_my_player_ids','fn_my_team_id'];
  public_rpcs text[] := array['register_trialist','get_trial_by_token'];
  r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p
           where p.pronamespace='public'::regnamespace and p.prokind='f' loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
  for r in select p.oid::regprocedure as sig from pg_proc p
           where p.pronamespace='public'::regnamespace and p.prokind='f'
             and p.proname = any(client_rpcs) loop
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
  for r in select p.oid::regprocedure as sig from pg_proc p
           where p.pronamespace='public'::regnamespace and p.prokind='f'
             and p.proname = any(policy_helpers) loop
    execute format('grant execute on function %s to authenticated, anon', r.sig);
  end loop;
  for r in select p.oid::regprocedure as sig from pg_proc p
           where p.pronamespace='public'::regnamespace and p.prokind='f'
             and p.proname = any(public_rpcs) loop
    execute format('grant execute on function %s to anon, authenticated', r.sig);
  end loop;
end $$;
