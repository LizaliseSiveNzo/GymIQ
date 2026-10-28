-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.

-- 0065: Trainer announcements. A trainer posts a message; all their active
-- clients can read it. Replaces the football team-based announcements model.

create table if not exists trainer_announcements (
  id         uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references users(id) on delete cascade,
  title      text,
  body       text not null,
  created_at timestamptz default now()
);
create index if not exists idx_tann_trainer on trainer_announcements(trainer_id, created_at desc);

alter table trainer_announcements enable row level security;

-- Trainer manages their own posts.
create policy tann_trainer_all on trainer_announcements for all
  using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());

-- A client reads posts from any trainer they're actively linked to.
create policy tann_client_read on trainer_announcements for select
  using (exists (
    select 1 from trainer_clients tc
    where tc.trainer_id = trainer_announcements.trainer_id
      and tc.client_id = auth.uid()
      and tc.status = 'active'
  ));
