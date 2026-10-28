-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.

-- 0071: AI form-check results (analysis simulated for now; schema ready for a
-- real vision model). Client owns their checks; trainer can read their clients'.

create table if not exists form_checks (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references users(id) on delete cascade,
  exercise   text not null,
  score      int,
  summary    text,
  feedback   jsonb,
  simulated  boolean not null default true,
  created_at timestamptz default now()
);
create index if not exists idx_formcheck_client on form_checks(client_id, created_at desc);

alter table form_checks enable row level security;

create policy formcheck_client_all on form_checks for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy formcheck_trainer_read on form_checks for select
  using (fn_is_my_client(client_id));
