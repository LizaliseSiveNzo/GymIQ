-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- PitchIQ — proprietary and confidential. See LICENSE.
-- Team-level coaching journal entries (aggregated with training + match journals)
create table if not exists public.coach_journal_entries (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  coach_id uuid references public.users(id) on delete set null,
  entry_date date not null default current_date,
  title text not null, body text,
  category text not null default 'General'
    check (category in ('General','Tactical','Technical','Physical','Team culture','Planning')),
  created_at timestamptz not null default now()
);
create index if not exists idx_journal_team on public.coach_journal_entries(team_id, entry_date desc);
alter table public.coach_journal_entries enable row level security;
drop policy if exists journal_coach on public.coach_journal_entries;
create policy journal_coach on public.coach_journal_entries for all
  using (team_id in (select fn_coach_team_ids())) with check (team_id in (select fn_coach_team_ids()));
drop policy if exists journal_admin on public.coach_journal_entries;
create policy journal_admin on public.coach_journal_entries for all using (current_role_of() = 'admin');
