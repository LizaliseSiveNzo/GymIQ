-- Calisthenics: add missing bodyweight compound movements and allow 'calisthenics' as a goal.
insert into exercises (name, primary_muscle_id, secondary_muscle_fraction, movement_pattern, laterality, stability_demand, equipment_ids, is_weighted, cue_text, difficulty, category, sort_order) values
 ('Bodyweight Squat', 'quads', '{"glutes": 0.5, "adductors": 0.3}'::jsonb, 'squat', 'bilateral', 3, '{"bodyweight"}', false, 'Stand with feet shoulder-width; sit the hips back and down until the thighs are near parallel; drive through the feet to stand.', 1, 'Legs', 111),
 ('Jump Squat', 'quads', '{"glutes": 0.4, "calves": 0.3}'::jsonb, 'squat', 'bilateral', 4, '{"bodyweight"}', false, 'Squat down then explode upward into a jump; land softly and descend straight into the next rep.', 3, 'Legs', 112),
 ('Pistol Squat', 'quads', '{"glutes": 0.4}'::jsonb, 'squat', 'unilateral_single', 5, '{"bodyweight"}', false, 'Stand on one leg with the other extended forward; lower into a single-leg squat; drive up without the free leg touching the floor.', 3, 'Legs', 113),
 ('Bodyweight Lunge', 'quads', '{"glutes": 0.5, "hamstrings": 0.3}'::jsonb, 'lunge', 'unilateral_alt', 3, '{"bodyweight"}', false, 'Step forward and lower the rear knee toward the floor; push through the front heel to return; alternate legs.', 2, 'Legs', 114),
 ('Bodyweight Split Squat', 'quads', '{"glutes": 0.5, "adductors": 0.3}'::jsonb, 'lunge', 'unilateral_alt', 3, '{"bodyweight"}', false, 'Stand in a staggered stance; lower straight down until the rear knee nears the floor; drive through the front foot to rise.', 2, 'Legs', 115),
 ('Glute Bridge', 'glutes', '{"hamstrings": 0.5}'::jsonb, 'hinge', 'bilateral', 2, '{"mat","bodyweight"}', false, 'Lie on your back with knees bent; drive the hips up by squeezing the glutes; hold the top and lower with control.', 1, 'Legs', 116),
 ('Single-Leg Glute Bridge', 'glutes', '{"hamstrings": 0.5}'::jsonb, 'hinge', 'unilateral_single', 3, '{"mat","bodyweight"}', false, 'Lie on your back with one foot planted and the other extended; drive the hips up on the working leg; lower and switch sides.', 2, 'Legs', 117),
 ('Pike Push-Up', 'front_delts', '{"triceps": 0.5, "chest": 0.3}'::jsonb, 'vertical_push', 'bilateral', 4, '{"bodyweight"}', false, 'From a downward-dog position with hips high, bend the elbows to lower the crown toward the floor; press back up.', 3, 'Shoulders', 118),
 ('Inverted Row', 'lats', '{"upper_back": 0.5, "biceps": 0.4}'::jsonb, 'horizontal_pull', 'bilateral', 3, '{"pull_up_bar"}', false, 'Hang under a low bar with a straight body; pull the chest to the bar by driving the elbows back; lower under control.', 2, 'Back', 119);

alter table workout_programmes drop constraint if exists workout_programmes_goal_check;
alter table workout_programmes add constraint workout_programmes_goal_check
  check (goal in ('hypertrophy','strength','both','fat_loss','calisthenics'));
