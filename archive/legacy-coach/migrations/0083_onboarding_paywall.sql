-- 0083_onboarding_paywall: disclaimer consent columns, entitlements (structure
-- only — billing wires up post-Phase 7), and a defensive self-update policy so
-- the onboarding wizard can persist profile answers.
alter table users
  add column if not exists disclaimer_version text,
  add column if not exists disclaimer_accepted_at timestamptz;

create table if not exists entitlements (
  user_id uuid primary key references users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('trial','premium_monthly','premium_yearly','free')),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  status text not null default 'none' check (status in ('active','expired','none')),
  updated_at timestamptz not null default now()
);
alter table entitlements enable row level security;
drop policy if exists ent_owner_all on entitlements;
create policy ent_owner_all on entitlements for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on entitlements to authenticated;

-- The wizard writes profile columns directly; make sure a self-update path exists.
drop policy if exists users_self_update on users;
create policy users_self_update on users for update
  using (id = auth.uid()) with check (id = auth.uid());
