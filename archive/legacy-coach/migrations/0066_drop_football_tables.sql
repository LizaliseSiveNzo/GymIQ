-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.

-- 0066: Drop all football (PitchIQ) tables. The app is now fully trainer<->client
-- fitness: Dashboard, Schedule, Announcements and Journal were reworked onto the
-- new model, and no remaining code references any of these tables. CASCADE clears
-- the inter-table FKs, policies, and any football-only triggers/functions bound to
-- them. Fitness/core tables (users, organisations, notifications, trainer_clients,
-- programmes, logs, metrics, nutrition, appointments, journal, announcements) are
-- kept — none of them reference the dropped tables.

drop table if exists
  announcement_recipients,
  announcements,
  attendance,
  coach_journal_entries,
  coach_player_notes,
  development_milestones,
  development_goals,
  event_rsvps,
  injuries,
  match_substitutions,
  match_lineups,
  matches,
  medical_notes,
  player_attribute_history,
  player_attributes,
  player_files,
  player_match_stats,
  players,
  team_events,
  teams,
  training_standouts,
  training_sessions,
  trial_registrations,
  trials
cascade;
