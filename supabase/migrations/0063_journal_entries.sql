-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.

-- 0063: Trainer's journal. The old coach_journal_entries is tied to a football
-- team (team_id NOT NULL); this is a clean, trainer-owned journal with an
-- optional link to one of their clients. Trainer-private.

create table if not exists journal_entries (
  id         uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references users(id) on delete cascade,
  client_id  uuid references users(id) on delete set null,
  entry_date date not null default current_date,
  title      text not null,
  body       text,
  created_at timestamptz default now()
);
create index if not exists idx_journal_trainer on journal_entries(trainer_id, entry_date desc);

alter table journal_entries enable row level security;

create policy journal_trainer_all on journal_entries for all
  using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());
