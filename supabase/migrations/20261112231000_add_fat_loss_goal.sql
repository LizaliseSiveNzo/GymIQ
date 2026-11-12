-- Add 'weight_loss' to the workout_programmes goal options.
-- The generator, onboarding and personal coach now accept weight loss as a
-- primary training goal. Additive only: existing goals are unchanged.
alter table workout_programmes
  drop constraint if exists workout_programmes_goal_check;

alter table workout_programmes
  add constraint workout_programmes_goal_check
    check (goal in ('hypertrophy','strength','both','weight_loss'));
