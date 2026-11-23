-- 0081_muscles_equipment_exercises: catalog foundation for the MF rebuild.
create table if not exists muscles (
  id text primary key, name text not null,
  region text not null check (region in ('upper','lower','core')),
  front_back text not null check (front_back in ('front','back','both')),
  sort_order int not null default 0
);
create table if not exists equipment_items (
  id text primary key, name text not null,
  category text not null check (category in ('barbell','dumbbell','machine','cable','kettlebell','bodyweight','bench','bar','cardio','accessory','other')),
  default_denominations_kg numeric[] default '{}', sort_order int not null default 0
);
create table if not exists gym_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null, icon text, is_default boolean not null default false,
  created_at timestamptz default now()
);
create table if not exists gym_profile_equipment (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references gym_profiles(id) on delete cascade,
  equipment_id text not null references equipment_items(id) on delete cascade,
  selected boolean not null default true, denominations_kg numeric[] default '{}',
  unique (profile_id, equipment_id)
);
create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  primary_muscle_id text references muscles(id),
  secondary_muscle_fraction jsonb default '{}',
  movement_pattern text,
  laterality text check (laterality in ('bilateral','unilateral_alt','unilateral_single')) default 'bilateral',
  stability_demand int check (stability_demand between 1 and 5) default 3,
  rom_category text default 'full',
  equipment_ids text[] default '{}',
  is_weighted boolean default true,
  cue_text text, setup_notes text, media_ref text,
  is_custom boolean default false,
  owner_user_id uuid references users(id) on delete cascade,
  difficulty int check (difficulty between 1 and 3) default 2,
  category text, sort_order int default 0,
  created_at timestamptz default now()
);
create unique index if not exists exercises_global_name_key on exercises (lower(name)) where owner_user_id is null;
create index if not exists idx_exercises_primary on exercises(primary_muscle_id);
create index if not exists idx_gpe_profile on gym_profile_equipment(profile_id);

alter table muscles enable row level security;
alter table equipment_items enable row level security;
alter table exercises enable row level security;
alter table gym_profiles enable row level security;
alter table gym_profile_equipment enable row level security;

drop policy if exists muscles_read on muscles;
create policy muscles_read on muscles for select to authenticated using (true);
drop policy if exists equipment_read on equipment_items;
create policy equipment_read on equipment_items for select to authenticated using (true);
-- exercises: global rows readable by all; custom rows owned by their creator
drop policy if exists exercises_read on exercises;
create policy exercises_read on exercises for select to authenticated using (owner_user_id is null or owner_user_id = auth.uid());
drop policy if exists exercises_own_write on exercises;
create policy exercises_own_write on exercises for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
-- gym profiles: user owns
create policy gp_owner_all on gym_profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy gpe_owner_all on gym_profile_equipment for all
  using (exists (select 1 from gym_profiles p where p.id = profile_id and p.user_id = auth.uid()))
  with check (exists (select 1 from gym_profiles p where p.id = profile_id and p.user_id = auth.uid()));

grant select on muscles, equipment_items to authenticated, anon;
grant select, insert, update, delete on exercises, gym_profiles, gym_profile_equipment to authenticated;

insert into muscles (id,name,region,front_back,sort_order) values
  ('chest','Chest','upper','front',0),
  ('front_delts','Front Delts','upper','front',1),
  ('side_delts','Side Delts','upper','both',2),
  ('rear_delts','Rear Delts','upper','back',3),
  ('biceps','Biceps','upper','front',4),
  ('triceps','Triceps','upper','back',5),
  ('forearms','Forearms','upper','both',6),
  ('upper_back','Upper Back','upper','back',7),
  ('lats','Lats','upper','back',8),
  ('traps','Traps','upper','back',9),
  ('abs','Abs','core','front',10),
  ('obliques','Obliques','core','front',11),
  ('lower_back','Lower Back','core','back',12),
  ('glutes','Glutes','lower','back',13),
  ('quads','Quads','lower','front',14),
  ('hamstrings','Hamstrings','lower','back',15),
  ('adductors','Adductors','lower','front',16),
  ('abductors','Abductors','lower','both',17),
  ('calves','Calves','lower','back',18),
  ('neck','Neck','upper','both',19)
on conflict (id) do nothing;

insert into equipment_items (id,name,category,default_denominations_kg,sort_order) values
  ('barbell','Barbell','barbell','{}',0),
  ('ez_bar','EZ Bar','barbell','{}',1),
  ('trap_bar','Trap Bar','barbell','{}',2),
  ('landmine','Landmine','barbell','{}',3),
  ('dumbbells','Dumbbells','dumbbell','{2.5,5,7.5,10,12.5,15,17.5,20,22.5,25,27.5,30,32.5,35,40,45,50}',4),
  ('kettlebell','Kettlebell','kettlebell','{8,12,16,20,24,28,32}',5),
  ('flat_bench','Flat Bench','bench','{}',6),
  ('incline_bench','Incline Bench','bench','{}',7),
  ('decline_bench','Decline Bench','bench','{}',8),
  ('preacher_bench','Preacher Bench','bench','{}',9),
  ('squat_rack','Squat Rack','machine','{}',10),
  ('smith_machine','Smith Machine','machine','{}',11),
  ('cable_machine','Cable Machine','cable','{}',12),
  ('lat_pulldown','Lat Pulldown','cable','{}',13),
  ('seated_row_machine','Seated Row Machine','machine','{}',14),
  ('t_bar_row','T-Bar Row','machine','{}',15),
  ('pec_deck','Pec Deck','machine','{}',16),
  ('chest_press_machine','Chest Press Machine','machine','{}',17),
  ('shoulder_press_machine','Shoulder Press Machine','machine','{}',18),
  ('leg_press','Leg Press','machine','{}',19),
  ('hack_squat','Hack Squat','machine','{}',20),
  ('leg_extension_machine','Leg Extension Machine','machine','{}',21),
  ('leg_curl_machine','Leg Curl Machine','machine','{}',22),
  ('seated_calf_machine','Seated Calf Machine','machine','{}',23),
  ('standing_calf_machine','Standing Calf Machine','machine','{}',24),
  ('hip_abduction_machine','Hip Abduction Machine','machine','{}',25),
  ('pull_up_bar','Pull-Up Bar','bodyweight','{}',26),
  ('dip_bars','Dip Bars','bodyweight','{}',27),
  ('roman_chair','Roman Chair','machine','{}',28),
  ('rope_attachment','Rope Attachment','cable','{}',29),
  ('straight_bar_attachment','Straight Bar Attachment','cable','{}',30),
  ('v_bar_attachment','V-Bar Attachment','cable','{}',31),
  ('ankle_strap','Ankle Strap','accessory','{}',32),
  ('resistance_band','Resistance Band','accessory','{}',33),
  ('ab_wheel','Ab Wheel','accessory','{}',34),
  ('medicine_ball','Medicine Ball','accessory','{}',35),
  ('bosu','BOSU Trainer','accessory','{}',36),
  ('box','Plyo Box','accessory','{}',37),
  ('jump_rope','Jump Rope','cardio','{}',38),
  ('treadmill','Treadmill','cardio','{}',39),
  ('stationary_bike','Stationary Bike','cardio','{}',40),
  ('rowing_machine','Rowing Machine','cardio','{}',41),
  ('elliptical','Elliptical','cardio','{}',42),
  ('stair_climber','Stair Climber','cardio','{}',43),
  ('bodyweight','Bodyweight','bodyweight','{}',44),
  ('mat','Mat','bodyweight','{}',45),
  ('wall','Wall','bodyweight','{}',46)
on conflict (id) do nothing;
