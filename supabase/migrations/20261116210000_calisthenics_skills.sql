-- Calisthenics skill training: per-user selections, levels and progress.
-- Health/progress data stays user-scoped via RLS; never enters any shared cache.
create table if not exists public.calisthenics_skill_selections (
  user_id uuid not null references public.users(id) on delete cascade,
  skill_id text not null,
  priority int not null default 1 check (priority between 1 and 4),
  level text not null default 'not_yet' check (level in ('not_yet','learning','able')),
  paused boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, skill_id)
);
create table if not exists public.calisthenics_skill_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  skill_id text not null,
  variation text not null,
  sets int, reps int, hold_seconds int, assistance text,
  difficulty text check (difficulty in ('too_easy','right','too_hard')),
  controlled boolean,
  action text check (action in ('completed','too_difficult','too_easy','equipment_unavailable','pain')),
  logged_at timestamptz not null default now()
);
create index if not exists skill_logs_user on public.calisthenics_skill_logs(user_id, skill_id, logged_at desc);

alter table public.calisthenics_skill_selections enable row level security;
alter table public.calisthenics_skill_logs enable row level security;
revoke all on public.calisthenics_skill_selections, public.calisthenics_skill_logs from public, anon;
grant all on public.calisthenics_skill_selections, public.calisthenics_skill_logs to authenticated;
drop policy if exists skill_sel_owner on public.calisthenics_skill_selections;
create policy skill_sel_owner on public.calisthenics_skill_selections for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists skill_log_owner on public.calisthenics_skill_logs;
create policy skill_log_owner on public.calisthenics_skill_logs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
