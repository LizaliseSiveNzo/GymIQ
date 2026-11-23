-- 0074_exercise_presets
-- Global master exercise library (read-only to all authenticated users), seeded
-- from the Comprehensive Exercise Database Plan. Users pick presets when filling
-- a workout block instead of typing exercises by hand.

create table if not exists exercise_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  primary_category text not null,
  target_muscles text,
  equipment text,
  description text,
  video_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table exercise_presets enable row level security;
drop policy if exists exercise_presets_read on exercise_presets;
create policy exercise_presets_read on exercise_presets for select to authenticated using (true);

-- Let block exercises reference a preset and carry a coaching description.
alter table block_exercises add column if not exists description text;
alter table block_exercises add column if not exists muscles text;
alter table block_exercises add column if not exists equipment text;
alter table block_exercises add column if not exists preset_id uuid references exercise_presets(id) on delete set null;

-- Seed (idempotent: clear then insert the canonical set).
delete from exercise_presets;
insert into exercise_presets (name, primary_category, target_muscles, equipment, description, sort_order) values
  ('Barbell Bench Press','Chest','Pectoralis Major (Sternocostal), Anterior Deltoid, Triceps Brachii','Barbell, Flat Bench','Lie flat on bench; grip bar slightly wider than shoulder-width; lower bar to mid-chest with elbows at 45°; press upward to full lockout.',0),
  ('Incline Dumbbell Bench Press','Chest','Pectoralis Major (Clavicular Head), Anterior Deltoid','Dumbbells, Incline Bench','Set bench to 30–45°; press dumbbells vertically from shoulder height to chest midline; lower under control to feel an upper-chest stretch.',1),
  ('Dumbbell Chest Flys','Chest','Pectoralis Major, Serratus Anterior','Dumbbells, Flat Bench','Lie flat holding dumbbells overhead; lower weights outward in a wide arc with elbows slightly flexed; squeeze pecs to return to center.',2),
  ('Standing Cable Chest Fly','Chest','Pectoralis Major, Serratus Anterior, Anterior Deltoid','Cable Machine','Stand between pulleys at chest height; bring handles together in front of chest in a controlled hugging motion; manage the eccentric stretch.',3),
  ('Bodyweight Push-Up','Chest','Pectoralis Major, Triceps Brachii, Anterior Deltoid','Bodyweight','Maintain a rigid high-plank position; lower chest to floor by bending elbows to 90°; push through palms to extend arms fully.',4),
  ('Decline Barbell Bench Press','Chest','Pectoralis Major (Lower Sternocostal), Triceps Brachii','Barbell, Decline Bench','Secure feet on decline bench; lower barbell smoothly to lower sternum; press explosively upward until elbows lock out.',5),
  ('Parallel Bar Chest Dips','Chest','Pectoralis Major (Lower Head), Anterior Deltoid, Triceps','Parallel Bars','Suspend body on bars; lean torso forward 30 degrees; bend elbows to lower body until shoulders are below elbows; press upward.',6),
  ('Dumbbell Pullover','Chest','Pectoralis Major, Latissimus Dorsi, Serratus Anterior','Dumbbell, Flat Bench','Lie perpendicular across bench with shoulders supported; lower dumbbell behind head in an arc; pull back over chest using pecs and lats.',7),
  ('Bent-Over Barbell Row','Back','Latissimus Dorsi, Rhomboids, Trapezius, Erector Spinae','Barbell','Hinge at hips with back flat; grip bar palms down; pull bar upward toward navel by driving elbows back; lower under control.',8),
  ('One-Arm Dumbbell Row','Back','Latissimus Dorsi, Rhomboids, Posterior Deltoid','Dumbbell, Flat Bench','Support knee and hand on bench; pull dumbbell up toward hip with opposite arm; squeeze shoulder blade at top peak contraction.',9),
  ('Lat Pulldown','Back','Latissimus Dorsi, Teres Major, Biceps Brachii','Cable Pulldown','Sit at machine; grip wide bar overhead; pull bar down toward upper chest while driving elbows down and pulling shoulder blades together.',10),
  ('Seated Cable Row','Back','Rhomboids, Trapezius (Mid/Lower), Latissimus Dorsi','Cable Machine, V-Bar','Sit upright with feet braced; pull handle toward abdomen while retracting shoulder blades; avoid excessive backward leaning.',11),
  ('Bodyweight Pull-Up','Back','Latissimus Dorsi, Rhomboids, Brachialis','Pull-Up Bar','Hang from overhead bar with overhand grip; pull chest up to bar level by driving elbows downward; lower slowly to full dead hang.',12),
  ('Barbell Shrug','Back','Upper Trapezius, Levator Scapulae','Barbell','Stand upright holding bar at thigh level; elevate shoulders straight up toward ears without bending elbows; pause briefly at peak.',13),
  ('Hyperextension (Back Extension)','Back','Erector Spinae, Gluteus Maximus, Hamstrings','Roman Chair / Bench','Anchor ankles on bench pad; lower torso forward toward floor; extend hips and spine to bring body back into alignment.',14),
  ('90 Lat Stretch','Back','Latissimus Dorsi, Teres Major','No Equipment','Hinge at waist with hands pressed against wall or bench; gently lower chest toward floor to lengthen lateral back musculature.',15),
  ('Overhead Military Press','Shoulders','Anterior Deltoid, Medial Deltoid, Triceps Brachii','Barbell','Stand upright; press bar vertically from front rack position overhead until arms extend fully; keep core and glutes locked tight.',16),
  ('Seated Dumbbell Shoulder Press','Shoulders','Anterior Deltoid, Medial Deltoid, Upper Trapezius','Dumbbells, Bench','Sit upright; hold dumbbells at ear height; press overhead in a slight inward arc until weights align over head; lower slowly.',17),
  ('Dumbbell Lateral Raise','Shoulders','Medial Deltoid (Side Delts)','Dumbbells','Stand erect holding dumbbells at sides; raise arms laterally outward until parallel with floor; lower slowly without momentum.',18),
  ('Bent-Over Dumbbell Rear Delt Fly','Shoulders','Posterior Deltoid, Rhomboids, Infraspinatus','Dumbbells','Hinge forward at waist 90 degrees; raise dumbbells outward laterally with elbows soft, focusing on contracting rear shoulders.',19),
  ('Cable Face Pull','Shoulders','Posterior Deltoid, Rotator Cuff, Mid-Trapezius','Cable Machine, Rope','Attach rope to upper cable; pull handles toward forehead while flaring elbows high and externally rotating shoulders back.',20),
  ('Barbell Front Raise','Shoulders','Anterior Deltoid, Upper Pectoralis','Barbell','Hold bar across thighs with pronated grip; lift arms forward overhead to eye level while keeping arms straight; lower under control.',21),
  ('Standing Barbell Biceps Curl','Arms','Biceps Brachii (Long & Short Heads), Brachialis','Barbell','Hold bar with shoulder-width underhand grip; curl weight toward chest while keeping upper arms pinned to sides; lower slowly.',22),
  ('Dumbbell Hammer Curl','Arms','Brachioradialis, Biceps Brachii, Brachialis','Dumbbells','Hold dumbbells with neutral palms-facing-in grip; flex elbows to lift weights toward shoulders; lower controlled.',23),
  ('Incline Dumbbell Curl','Arms','Biceps Brachii (Long Head)','Dumbbells, Incline Bench','Sit on 45-degree incline bench; let arms hang back; curl weights upward without allowing upper arms to swing forward.',24),
  ('Preacher Curl','Arms','Biceps Brachii (Short Head), Brachialis','EZ-Bar, Preacher Bench','Rest upper arms flat against preacher bench pad; lower bar to full elbow extension; curl upward squeezing biceps at peak.',25),
  ('Straight Bar Tricep Extension','Arms','Triceps Brachii (Lateral & Medial Heads)','Cable Machine, Bar','Attach bar to high pulley; keep elbows stationary at sides; press bar downward until elbows lock out fully.',26),
  ('Seated Overhead Tricep Extension','Arms','Triceps Brachii (Long Head)','Dumbbell, Bench','Hold single dumbbell overhead with both hands; lower weight behind head by flexing elbows; press back up to full extension.',27),
  ('Close-Grip Barbell Bench Press','Arms','Triceps Brachii, Pectoralis Major','Barbell, Flat Bench','Lie flat on bench; grip barbell narrow at shoulder-width; lower bar to lower chest keeping elbows tucked close; press up.',28),
  ('Lying Triceps Extension (Skullcrusher)','Arms','Triceps Brachii (Long & Lateral Heads)','EZ-Bar, Bench','Lie flat holding bar over chest; bend elbows to lower bar toward forehead; extend elbows back to overhead starting point.',29),
  ('Seated Wrist Curls','Arms','Flexor Carpi Radialis, Flexor Carpi Ulnaris','Dumbbells / Barbell','Rest forearms along thighs with palms up; lower wrist into extension; curl wrists upward to contract forearm flexors.',30),
  ('Barbell Back Squat','Legs','Quadriceps, Gluteus Maximus, Adductor Magnus','Barbell, Squat Rack','Rest bar across upper traps; descend by bending knees and flexing hips until thighs parallel floor; press through feet to ascend.',31),
  ('Barbell Front Squat','Legs','Quadriceps (Rectus Femoris), Gluteus Maximus','Barbell, Squat Rack','Rack bar across anterior deltoids; keep elbows raised high; squat vertically maintaining upright posture; press up.',32),
  ('Leg Press Machine','Legs','Quadriceps, Gluteus Maximus, Adductors','Leg Press Machine','Place feet hip-width on sled; disengage safety catches; lower sled until knees reach 90 degrees; drive through platform to extend legs.',33),
  ('Walking Dumbbell Lunge','Legs','Quadriceps, Gluteus Maximus, Hamstrings','Dumbbells','Step forward with one leg; lower back knee toward floor to 90 degrees flex; drive through front heel to step into next stride.',34),
  ('Bulgarian Split Squat','Legs','Quadriceps, Gluteus Maximus, Adductor Magnus','Dumbbells, Bench','Place rear foot elevated on bench behind; descend on front leg until rear knee nears floor; push through front foot to rise.',35),
  ('Goblet Squat','Legs','Quadriceps, Core, Gluteus Maximus','Kettlebell / Dumbbell','Hold weight close to sternum; keep chest upright while squatting down between knees; push through floor to return up.',36),
  ('Barbell Romanian Deadlift','Legs','Hamstrings, Gluteus Maximus, Erector Spinae','Barbell','Stand holding bar; hinge at hips pushing glutes back with slight knee bend until stretch is felt in hamstrings; extend hips up.',37),
  ('Dumbbell Stiff-Legged Deadlift','Legs','Hamstrings, Gluteus Maximus, Erector Spinae','Dumbbells','Hold weights in front of thighs; lower dumbbells toward feet with knees relatively rigid and flat spine; return by extending hips.',38),
  ('Lying Leg Curl','Legs','Hamstrings (Biceps Femoris, Semitendinosus)','Leg Curl Machine','Lie prone on machine with pad against lower calves; curl pad toward glutes by flexing knees; lower weight controlled.',39),
  ('Barbell Hip Thrust','Legs','Gluteus Maximus, Gluteus Medius','Barbell, Bench','Position upper back against bench with padded bar across hips; drive through heels to extend hips horizontally into lockout.',40),
  ('Cable Glute Kickback','Legs','Gluteus Maximus, Hamstrings','Cable Machine, Ankle Strap','Attach strap to low cable; hinge slightly at waist; extend leg backward dynamically by contracting glute; return under control.',41),
  ('Seated Hip Abduction Machine','Legs','Gluteus Medius, Gluteus Minimus, Tensor Fasciae Latae','Abductor Machine','Sit on machine with outer knees against pads; push legs outward laterally against resistance; slowly control returning phase.',42),
  ('Standing Machine Calf Raise','Legs','Gastrocnemius, Soleus','Calf Machine','Position shoulders under pads with toes on platform edge; lower heels deep into stretch; push through balls of feet to rise high.',43),
  ('Seated Calf Raise','Legs','Soleus','Seated Calf Machine','Sit with pad secured over lower thighs; flex ankles to lift heels as high as possible; lower down into a full heel stretch.',44),
  ('Tibialis Anterior Raise','Legs','Tibialis Anterior','Wall / Bodyweight','Stand leaning upper back against wall; flex ankles to dorsiflex toes upward toward shins; hold brief pause and lower toes.',45),
  ('Abdominal Crunch','Core','Rectus Abdominis','Mat / Bodyweight','Lie on back with knees bent; flex spine to lift shoulder blades off floor; squeeze abs at peak contraction and lower slowly.',46),
  ('Hanging Leg Raise','Core','Rectus Abdominis, Hip Flexors, Obliques','Pull-Up Bar','Hang from overhead bar; maintain still upper body while raising straight legs forward until parallel with floor; lower smoothly.',47),
  ('Forearm Plank Hold','Core','Transverse Abdominis, Rectus Abdominis, Erector Spinae','Bodyweight','Support body weight on forearms and toes; maintain a straight horizontal line from head to heels while bracing core tight.',48),
  ('Seated Russian Twist','Core','Internal & External Obliques, Rectus Abdominis','Medicine Ball / Weight','Sit with knees flexed and feet hovering; rotate torso side to side, lightly touching weight to floor on alternate sides.',49),
  ('Standing Cable Woodchopper','Core','External Obliques, Internal Obliques, Transverse Abdominis','Cable Machine','Hold high pulley handle with both hands; pull cable diagonally down across torso toward opposite knee while rotating hips.',50),
  ('Bird Dog Hold and Flex','Core','Erector Spinae, Gluteus Maximus, Rectus Abdominis','Mat / Bodyweight','Start on all fours; extend opposite arm forward and opposite leg back horizontally; pause, contract, and alternate sides.',51),
  ('Cat-Cow Mobility Stretch','Core','Erector Spinae, Rectus Abdominis','Mat / Bodyweight','Begin on hands and knees; alternate between arching spine toward ceiling (Cat) and dropping belly while lifting head (Cow).',52),
  ('Dynamic Plank Up-Downs','Core','Transverse Abdominis, Deltoids, Triceps','Bodyweight','Begin in forearm plank; press up one hand at a time into top push-up position; lower back to forearms rhythmically.',53),
  ('Kettlebell Swing','Full Body','Gluteus Maximus, Hamstrings, Erector Spinae, Deltoids','Kettlebell','Hinge at hips to swing kettlebell between legs; explode hips forward horizontally to propel kettlebell to shoulder height.',54),
  ('BOSU Ball Balance Squat','Full Body','Quadriceps, Gluteus Maximus, Core Stabilizers','BOSU Trainer','Stand upright on dome surface of BOSU trainer; perform squatting motion while actively maintaining dynamic equilibrium.',55),
  ('Alternate Leg Push-off','Full Body','Quadriceps, Gluteus Maximus, Calves','Raised Platform / Box','Place one foot atop box; drive explosively upward using top leg to elevate body; alternate landing feet atop platform controlled.',56);
