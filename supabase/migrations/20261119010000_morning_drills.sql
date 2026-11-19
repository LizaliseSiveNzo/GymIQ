-- Morning drills: each user picks a pool of body-weight floor/wall exercises
-- (at least 3); the app rotates 3 of them each morning.
create table if not exists public.morning_drill_prefs (
  user_id uuid primary key references public.users(id) on delete cascade,
  exercise_ids text[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.morning_drill_prefs enable row level security;
drop policy if exists morning_drill_prefs_own on public.morning_drill_prefs;
create policy morning_drill_prefs_own on public.morning_drill_prefs
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
