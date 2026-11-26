-- Allow 'log_food' coach actions (the voice coach and text coach both log eaten meals).
alter table public.coach_actions drop constraint if exists coach_actions_kind_check;
alter table public.coach_actions add constraint coach_actions_kind_check check (kind in ('meal','meal_plan','workout','log_food'));
