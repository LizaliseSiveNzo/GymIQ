-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.

-- 0067: Drop dead football functions and the last football policy.
-- After 0066 removed the football tables, these SECURITY DEFINER RPCs and RLS
-- helpers reference tables that no longer exist and nothing calls them. Kept:
-- current_role_of, fn_is_my_client, trainer_add_client_by_email, handle_new_user,
-- tg_flush_notification_emails (all still used by live policies/triggers/app).

-- Football policy on users (trainer access is covered by trainer_read_client_users).
drop policy if exists coach_read_player_users on users;

-- Dead storage policies for the football announcement-files bucket (they call
-- football helpers). The reworked trainer announcements have no file uploads.
drop policy if exists ann_files_read on storage.objects;
drop policy if exists ann_files_insert on storage.objects;
drop policy if exists ann_files_delete on storage.objects;

drop function if exists _require_admin_org();
drop function if exists add_coach_note(uuid,text);
drop function if exists admin_assign_player(uuid,uuid);
drop function if exists admin_broadcast(text,text,text);
drop function if exists admin_coaches();
drop function if exists admin_list_players();
drop function if exists admin_matches();
drop function if exists admin_player_stats();
drop function if exists admin_set_attendance(uuid,uuid,boolean);
drop function if exists admin_set_role(uuid,user_role);
drop function if exists admin_set_role_by_email(text,user_role);
drop function if exists admin_training_log();
drop function if exists clear_left_early(uuid,uuid);
drop function if exists coach_add_player_file(uuid,text,text,text,text);
drop function if exists create_coach_team(text,text,text);
drop function if exists delete_announcement(uuid);
drop function if exists delete_match(uuid);
drop function if exists delete_team_event(uuid);
drop function if exists delete_training_session(uuid);
drop function if exists enforce_checkin_present();
drop function if exists fn_coach_player_ids();
drop function if exists fn_coach_player_user_ids();
drop function if exists fn_coach_team_ids();
drop function if exists fn_my_player_ids();
drop function if exists fn_my_team_id();
drop function if exists get_trial_by_token(text);
drop function if exists match_lineup(uuid);
drop function if exists my_player_code();
drop function if exists my_player_overview();
drop function if exists notify_team(uuid,text);
drop function if exists player_ai_context(uuid);
drop function if exists player_card(uuid);
drop function if exists player_match_log(uuid);
drop function if exists player_score(uuid);
drop function if exists rank_from_score(numeric);
drop function if exists recompute_player_rank(uuid);
drop function if exists recompute_team_ranks(uuid);
drop function if exists record_attendance(uuid,text,text,text);
drop function if exists record_left_early(uuid,uuid,text);
drop function if exists register_trialist(text,text,integer,text,text,text,text);
drop function if exists session_attendance(uuid);
drop function if exists set_trial_outcome(uuid,text,text);
drop function if exists stat_leaderboard();
drop function if exists team_leaderboard(uuid);
drop function if exists tg_notify_match_change();
drop function if exists tg_notify_practice_change();
drop function if exists tg_snapshot_attribute();
