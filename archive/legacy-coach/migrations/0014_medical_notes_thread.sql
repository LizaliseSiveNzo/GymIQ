-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.

-- Injury & recovery discussion thread between a player and their coach (admin can view/post too)
create table if not exists medical_notes (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references players(id) on delete cascade,
  author_id   uuid references users(id) on delete set null,
  author_name text,
  author_role user_role,
  message     text not null,
  created_at  timestamptz default now()
);
create index if not exists idx_medical_player on medical_notes(player_id);

alter table medical_notes enable row level security;

drop policy if exists med_read on medical_notes;
drop policy if exists med_insert on medical_notes;

create policy med_read on medical_notes for select using (
  current_role_of() = 'admin'
  or player_id in (select id from players where user_id = auth.uid())
  or player_id in (select id from players where team_id in (select fn_coach_team_ids()))
);

create policy med_insert on medical_notes for insert with check (
  author_id = auth.uid() and (
    current_role_of() = 'admin'
    or player_id in (select id from players where user_id = auth.uid())
    or player_id in (select id from players where team_id in (select fn_coach_team_ids()))
  )
);
