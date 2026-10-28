-- 0075_block_categories_more_exercises
-- Colour-coded block categories + a larger preset library (adds Cardio and more
-- moves per region). Exercises stay pick-and-customize; blocks can be started
-- from a category preset or named custom.

alter table workout_blocks add column if not exists category text;

-- de-dupe guard so re-running the seed is idempotent
create unique index if not exists exercise_presets_name_key on exercise_presets(name);

insert into exercise_presets (name, primary_category, target_muscles, equipment, description, sort_order) values
  ('Treadmill Running','Cardio','Quadriceps, Hamstrings, Gastrocnemius, Cardiovascular','Treadmill','Set an intentional pace; stand tall with relaxed shoulders; drive the arms and land midfoot beneath the hips for steady aerobic effort.',100),
  ('Outdoor Running','Cardio','Quadriceps, Hamstrings, Calves, Cardiovascular','None','Run at a conversational-to-hard pace; keep a slight forward lean from the ankles; breathe rhythmically and land softly under your center of mass.',101),
  ('Stationary Cycling','Cardio','Quadriceps, Hamstrings, Gluteus Maximus, Cardiovascular','Stationary Bike','Set the saddle to hip height; pedal in smooth full circles; adjust resistance to hold a steady cadence for zone-2 or interval work.',102),
  ('Rowing Machine','Cardio','Latissimus Dorsi, Quadriceps, Hamstrings, Cardiovascular','Rowing Machine','Drive with the legs first, then swing the torso back, then pull the handle to the ribs; reverse that order smoothly on the recovery.',103),
  ('Jump Rope','Cardio','Calves, Shoulders, Cardiovascular','Jump Rope','Turn the rope from the wrists; jump just high enough to clear it; stay light on the balls of the feet with a steady rhythm.',104),
  ('Stair Climber','Cardio','Gluteus Maximus, Quadriceps, Calves, Cardiovascular','Stair Machine','Stand tall without leaning on the rails; step through the full range driving through the heel; hold a controlled continuous pace.',105),
  ('Elliptical Trainer','Cardio','Quadriceps, Hamstrings, Gluteus Maximus, Cardiovascular','Elliptical','Push and pull the handles in sync with the stride; keep an upright posture; maintain a smooth resistance-matched cadence.',106),
  ('High Knees','Cardio','Hip Flexors, Quadriceps, Core, Cardiovascular','Bodyweight','Run in place driving the knees to hip height; pump the arms; stay on the balls of the feet at a quick tempo.',107),
  ('Burpees','Cardio','Quadriceps, Pectoralis Major, Core, Cardiovascular','Bodyweight','Drop into a plank, perform a push-up, jump the feet back in, then explode upward; land softly and repeat continuously.',108),
  ('Mountain Climbers','Cardio','Rectus Abdominis, Hip Flexors, Shoulders, Cardiovascular','Bodyweight','Hold a high plank; drive the knees toward the chest alternately at a brisk pace while keeping the hips level and core braced.',109),
  ('Machine Chest Press','Chest','Pectoralis Major, Anterior Deltoid, Triceps Brachii','Chest Press Machine','Set the seat so the handles align mid-chest; press forward to full extension without harsh lockout; return under control to a stretch.',110),
  ('Incline Cable Fly','Chest','Pectoralis Major (Clavicular Head)','Cable Machine, Incline Bench','On an incline between low pulleys, sweep the handles up and together over the upper chest; control the eccentric back to a stretch.',111),
  ('Pec Deck Machine','Chest','Pectoralis Major','Pec Deck Machine','Sit with forearms on the pads; squeeze the pads together in front of the chest; open slowly to feel a controlled stretch.',112),
  ('T-Bar Row','Back','Latissimus Dorsi, Rhomboids, Trapezius','T-Bar / Landmine','Straddle the bar hinged at the hips with a flat back; pull the handles to the lower chest by driving the elbows back; lower under control.',113),
  ('Chest-Supported Dumbbell Row','Back','Latissimus Dorsi, Rhomboids, Posterior Deltoid','Dumbbells, Incline Bench','Lie chest-down on an incline bench; row the dumbbells to the hips by squeezing the shoulder blades together; lower slowly.',114),
  ('Straight-Arm Pulldown','Back','Latissimus Dorsi, Teres Major','Cable Machine','Stand facing a high pulley with straight arms; pull the bar down to the thighs in an arc using the lats; return with control.',115),
  ('Arnold Press','Shoulders','Anterior Deltoid, Medial Deltoid','Dumbbells','Start with palms facing you at chin height; rotate the palms outward as you press overhead; reverse the rotation on the way down.',116),
  ('Cable Lateral Raise','Shoulders','Medial Deltoid','Cable Machine','Stand side-on to a low pulley; raise the handle out to shoulder height with a soft elbow; lower slowly against the cable.',117),
  ('Upright Row','Shoulders','Medial Deltoid, Upper Trapezius','Barbell / Cable','Grip the bar shoulder-width; pull it up along the body to chest height leading with the elbows; lower under control.',118),
  ('Cable Rope Hammer Curl','Arms','Brachioradialis, Biceps Brachii','Cable Machine, Rope','Curl a low-pulley rope with a neutral grip; keep the elbows pinned to the sides; squeeze at the top and lower slowly.',119),
  ('Tricep Rope Pushdown','Arms','Triceps Brachii (Lateral Head)','Cable Machine, Rope','With elbows at your sides, push the rope down and spread the ends apart at the bottom; control the return to the start.',120),
  ('Concentration Curl','Arms','Biceps Brachii (Peak)','Dumbbell','Seated, brace the working elbow against the inner thigh; curl the dumbbell to the shoulder with a full squeeze; lower slowly.',121),
  ('Cable Overhead Tricep Extension','Arms','Triceps Brachii (Long Head)','Cable Machine, Rope','Face away from a high pulley; extend the rope overhead until the arms lock; control the stretch behind the head and repeat.',122),
  ('Leg Extension Machine','Legs','Quadriceps','Leg Extension Machine','Sit with the pad on the shins; extend the knees to straighten the legs; squeeze the quads at the top and lower slowly.',123),
  ('Seated Leg Curl','Legs','Hamstrings','Seated Leg Curl Machine','Secure the pad above the ankles; curl the legs down and under the seat; squeeze the hamstrings and return with control.',124),
  ('Conventional Deadlift','Legs','Gluteus Maximus, Hamstrings, Erector Spinae, Quadriceps','Barbell','Grip the bar with a flat back; drive through the floor extending hips and knees together; lock out tall, then hinge to lower.',125),
  ('Step-Up','Legs','Quadriceps, Gluteus Maximus','Dumbbells, Box','Plant one foot fully on the box; drive through that heel to stand up tall; lower the trailing foot under control and repeat.',126),
  ('Cable Crunch','Core','Rectus Abdominis','Cable Machine, Rope','Kneel below a high pulley holding the rope by the head; crunch the ribs toward the pelvis; return slowly resisting the weight.',127),
  ('Bicycle Crunch','Core','Rectus Abdominis, Obliques','Mat / Bodyweight','Lie back and alternate bringing each elbow toward the opposite knee while extending the other leg in a smooth pedaling motion.',128),
  ('Ab Wheel Rollout','Core','Rectus Abdominis, Transverse Abdominis','Ab Wheel','From the knees, roll the wheel forward keeping a braced neutral spine; extend as far as control allows; pull back with the abs.',129),
  ('Side Plank','Core','Obliques, Transverse Abdominis','Bodyweight','Stack the feet and prop on one forearm; lift the hips into a straight line; hold while bracing, then switch sides.',130)
on conflict (name) do nothing;
