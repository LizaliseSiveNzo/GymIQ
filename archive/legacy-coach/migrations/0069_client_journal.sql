-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.

-- 0069: Client journal. The client writes daily notes (how they feel, sleep,
-- cravings, energy); their trainer can read them. Distinct from client_notes,
-- which are the trainer's private notes ABOUT the client.

create table if not exists client_journal (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references users(id) on delete cascade,
  entry_date date not null default current_date,
  body       text not null,
  created_at timestamptz default now()
);
create index if not exists idx_cjournal_client on client_journal(client_id, created_at desc);

alter table client_journal enable row level security;

create policy cjournal_client_all on client_journal for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy cjournal_trainer_read on client_journal for select
  using (fn_is_my_client(client_id));
