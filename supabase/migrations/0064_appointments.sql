-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.

-- 0064: Appointments — a trainer books a session with a client at a date/time.
-- Replaces the football matches/training/team-events schedule. The trainer owns
-- and manages appointments; the client can see their own.

create table if not exists appointments (
  id           uuid primary key default gen_random_uuid(),
  trainer_id   uuid not null references users(id) on delete cascade,
  client_id    uuid not null references users(id) on delete cascade,
  starts_at    timestamptz not null,
  duration_min int not null default 60,
  note         text,
  status       text not null default 'scheduled' check (status in ('scheduled','completed','cancelled')),
  created_at   timestamptz default now()
);
create index if not exists idx_appt_trainer on appointments(trainer_id, starts_at);
create index if not exists idx_appt_client  on appointments(client_id, starts_at);

alter table appointments enable row level security;

create policy appt_trainer_all on appointments for all
  using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());
create policy appt_client_read on appointments for select
  using (client_id = auth.uid());
