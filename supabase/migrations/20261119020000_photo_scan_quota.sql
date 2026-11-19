-- Free-tier photo scan quota: 3 analyses per local day; premium is unlimited.
create table if not exists public.photo_scan_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists photo_scan_log_user_day on public.photo_scan_log(user_id, created_at);
alter table public.photo_scan_log enable row level security;
drop policy if exists photo_scan_log_own on public.photo_scan_log;
create policy photo_scan_log_own on public.photo_scan_log
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
