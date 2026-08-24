-- 0080_profile_v2: extend user profile for the MF-style rebuild + nutrition settings.
alter table users
  add column if not exists sex text check (sex in ('male','female')),
  add column if not exists dob date,
  add column if not exists height_cm numeric,
  add column if not exists body_fat_pct numeric,
  add column if not exists training_experience text check (training_experience in ('novice','intermediate','advanced')),
  add column if not exists cardio_experience text,
  add column if not exists acquisition_source text,
  add column if not exists units text default 'metric' check (units in ('metric','imperial')),
  add column if not exists theme text default 'dark' check (theme in ('system','light','dark')),
  add column if not exists health_link_consent boolean default false,
  add column if not exists onboarding_state jsonb default '{"phase":"basics","step":0}',
  add column if not exists onboarded_at timestamptz;

create table if not exists nutrition_settings (
  user_id uuid primary key references users(id) on delete cascade,
  goal_type text check (goal_type in ('cut','maintain','gain')) default 'maintain',
  weekly_rate_kg numeric default 0.5,
  calorie_mode text check (calorie_mode in ('adaptive','manual')) default 'manual',
  manual_target int,
  floor_kcal int default 1200,
  protein_g_per_kg numeric default 1.8,
  fat_pct int default 25,
  updated_at timestamptz default now()
);
alter table nutrition_settings enable row level security;
create policy ns_owner_all on nutrition_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on nutrition_settings to authenticated;
