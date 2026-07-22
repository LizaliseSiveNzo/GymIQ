-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.

-- GymIQ — Initial database schema (Phase 1)
-- Postgres / Supabase. Includes tables + Row Level Security policies.
-- Roles: admin | coach | parent | player

-- ---------- ENUMS ----------
create type user_role       as enum ('admin', 'coach', 'parent', 'player');
create type division_level  as enum ('U11','U12','U13','U14','U15','U16','U19','First_Team');
create type rank_level       as enum ('Rookie','Rising_Star','Elite','Master','Grand_Master');
create type trial_outcome    as enum ('accepted','declined','pending');

-- ---------- CORE TABLES ----------
create table organisations (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  sport_type        text not null default 'soccer',
  subscription_tier text not null default 'free',
  created_at        timestamptz default now()
);

create table users (
  id          uuid primary key default gen_random_uuid(),   -- matches auth.users.id
  name        text not null,
  email       text unique not null,
  role        user_role not null,
  org_id      uuid references organisations(id) on delete set null,
  created_at  timestamptz default now()
);

create table teams (
  id        uuid primary key default gen_random_uuid(),
  org_id    uuid not null references organisations(id) on delete cascade,
  name      text not null,
  division  division_level not null,
  sport     text not null default 'soccer'
);

create table players (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references users(id) on delete set null,
  team_id        uuid references teams(id) on delete set null,
  position       text,
  date_of_birth  date,
  medical_notes  text,
  photo_url      text,
  rank_level     rank_level not null default 'Rookie',
  child_code     text unique,            -- parent uses this to link
  benched        boolean default false,
  bench_reason   text,
  created_at     timestamptz default now()
);

create table parent_player (
  parent_user_id uuid not null references users(id) on delete cascade,
  player_id      uuid not null references players(id) on delete cascade,
  primary key (parent_user_id, player_id)
);

create table training_sessions (
  id        uuid primary key default gen_random_uuid(),
  team_id   uuid not null references teams(id) on delete cascade,
  coach_id  uuid references users(id) on delete set null,
  date      date not null,
  notes     text,
  created_at timestamptz default now()
);

create table attendance (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references training_sessions(id) on delete cascade,
  player_id  uuid not null references players(id) on delete cascade,
  attended   boolean not null default false,
  unique (session_id, player_id)
);

create table matches (
  id        uuid primary key default gen_random_uuid(),
  team_id   uuid not null references teams(id) on delete cascade,
  opponent  text not null,
  date      timestamptz not null,
  venue     text,
  result    text
);

create table player_match_stats (
  id             uuid primary key default gen_random_uuid(),
  player_id      uuid not null references players(id) on delete cascade,
  match_id       uuid not null references matches(id) on delete cascade,
  minutes_played int default 0,
  goals          int default 0,
  assists        int default 0,
  rating         numeric(3,1) check (rating between 0 and 5),
  note           text,
  unique (player_id, match_id)
);

create table coach_player_notes (
  id         uuid primary key default gen_random_uuid(),
  coach_id   uuid references users(id) on delete set null,
  player_id  uuid not null references players(id) on delete cascade,
  note       text,
  diet_plan  text,
  created_at timestamptz default now()
);

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  message    text not null,
  read       boolean default false,
  created_at timestamptz default now()
);

create table trials (
  id        uuid primary key default gen_random_uuid(),
  org_id    uuid not null references organisations(id) on delete cascade,
  date      date not null,
  sport     text not null default 'soccer',
  qr_token  text unique                 -- encodes the public registration URL
);

create table trial_registrations (
  id           uuid primary key default gen_random_uuid(),
  trial_id     uuid not null references trials(id) on delete cascade,
  child_name   text not null,
  child_age    int,
  position     text,
  parent_name  text not null,
  parent_phone text,
  parent_email text,
  coach_notes  text,
  outcome      trial_outcome not null default 'pending',
  created_at   timestamptz default now()
);

-- ---------- INDEXES ----------
create index idx_players_team        on players(team_id);
create index idx_attendance_player   on attendance(player_id);
create index idx_stats_player        on player_match_stats(player_id);
create index idx_notes_player        on coach_player_notes(player_id);
create index idx_notifications_user  on notifications(user_id);
create index idx_trialreg_trial      on trial_registrations(trial_id);

-- ================= ROW LEVEL SECURITY =================
-- Helper: current user's role
create or replace function current_role_of()
returns user_role language sql stable as $$
  select role from users where id = auth.uid()
$$;

alter table users               enable row level security;
alter table players             enable row level security;
alter table teams               enable row level security;
alter table training_sessions   enable row level security;
alter table attendance          enable row level security;
alter table matches             enable row level security;
alter table player_match_stats  enable row level security;
alter table coach_player_notes  enable row level security;
alter table notifications       enable row level security;
alter table trial_registrations enable row level security;

-- Admins: full access on every RLS table
create policy admin_all_users   on users              for all using (current_role_of() = 'admin');
create policy admin_all_players on players            for all using (current_role_of() = 'admin');
create policy admin_all_teams   on teams              for all using (current_role_of() = 'admin');
create policy admin_all_ts      on training_sessions  for all using (current_role_of() = 'admin');
create policy admin_all_att     on attendance         for all using (current_role_of() = 'admin');
create policy admin_all_match   on matches            for all using (current_role_of() = 'admin');
create policy admin_all_stats   on player_match_stats for all using (current_role_of() = 'admin');
create policy admin_all_notes   on coach_player_notes for all using (current_role_of() = 'admin');

-- Coaches: read/update players on teams they coach (via training_sessions coach_id)
create policy coach_read_players on players for select using (
  current_role_of() = 'coach' and team_id in (
    select team_id from training_sessions where coach_id = auth.uid()
  )
);
create policy coach_update_players on players for update using (
  current_role_of() = 'coach' and team_id in (
    select team_id from training_sessions where coach_id = auth.uid()
  )
);
create policy coach_manage_notes on coach_player_notes for all using (
  current_role_of() = 'coach' and coach_id = auth.uid()
);

-- Parents: read only their own child
create policy parent_read_child on players for select using (
  id in (select player_id from parent_player where parent_user_id = auth.uid())
);
create policy parent_read_stats on player_match_stats for select using (
  player_id in (select player_id from parent_player where parent_user_id = auth.uid())
);
create policy parent_read_notes on coach_player_notes for select using (
  player_id in (select player_id from parent_player where parent_user_id = auth.uid())
);

-- Players: read their own profile
create policy player_read_self on players for select using (user_id = auth.uid());

-- Notifications: users see their own
create policy notif_own on notifications for all using (user_id = auth.uid());

-- NOTE: trials & organisations kept without RLS here (admin-managed via service role).
-- trial_registrations: public INSERT allowed (QR flow), reads restricted to staff.
create policy trialreg_public_insert on trial_registrations for insert with check (true);
create policy trialreg_staff_read on trial_registrations for select using (
  current_role_of() in ('admin','coach')
);
