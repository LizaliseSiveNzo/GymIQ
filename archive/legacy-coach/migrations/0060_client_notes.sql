-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.

-- 0060: Trainer's private notes about a client.
-- The old coach_player_notes.player_id references the football `players` table,
-- which user-based clients have no row in — so it can't be reused. This table is
-- keyed to users and is trainer-private (the client cannot read it).

create table if not exists client_notes (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references users(id) on delete cascade,
  trainer_id uuid not null references users(id) on delete cascade,
  note       text not null,
  created_at timestamptz default now()
);
create index if not exists idx_cnotes_client on client_notes(client_id);

alter table client_notes enable row level security;

-- Only the owning trainer, and only for their active clients.
create policy cnotes_trainer_all on client_notes for all
  using (trainer_id = auth.uid() and fn_is_my_client(client_id))
  with check (trainer_id = auth.uid() and fn_is_my_client(client_id));
