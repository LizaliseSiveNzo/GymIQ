-- Drop orphaned coach/trainer + intermediate tables (no current code references).
-- Source code and DDL were archived to archive/legacy-coach/ before removal.
drop table if exists public.appointments cascade;
drop table if exists public.block_exercises cascade;
drop table if exists public.workout_blocks cascade;
drop table if exists public.day_plans cascade;
drop table if exists public.day_plan_blocks cascade;
drop table if exists public.client_journal cascade;
drop table if exists public.journal_entries cascade;
drop table if exists public.trainer_clients cascade;
drop table if exists public.trainer_announcements cascade;
drop table if exists public.meal_plan_items cascade;
drop table if exists public.nutrition_plans cascade;
drop table if exists public.food_logs cascade;
drop table if exists public.form_checks cascade;
