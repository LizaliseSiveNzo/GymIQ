-- Security cleanup: drop truly-orphaned legacy tables and add a generic
-- per-user rate limiter for edge functions.
drop table if exists public.personal_records cascade;
drop table if exists public.entitlements cascade;
drop table if exists public.nutrition_settings cascade;
drop table if exists public.habits cascade;

create table if not exists public.edge_rate_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now()
);
create index if not exists edge_rate_limits_lookup on public.edge_rate_limits(user_id, kind, created_at);
alter table public.edge_rate_limits enable row level security;
revoke all on public.edge_rate_limits from anon, authenticated;
grant all on public.edge_rate_limits to service_role;

create or replace function public.consume_edge_rate(p_user uuid, p_kind text, p_limit int, p_window_seconds int)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  delete from public.edge_rate_limits where created_at < now() - make_interval(secs => p_window_seconds);
  if (select count(*) from public.edge_rate_limits where user_id=p_user and kind=p_kind and created_at > now() - make_interval(secs => p_window_seconds)) >= p_limit then
    return false;
  end if;
  insert into public.edge_rate_limits(user_id, kind) values(p_user, p_kind);
  return true;
end $$;
revoke all on function public.consume_edge_rate(uuid, text, int, int) from public, anon, authenticated;
grant execute on function public.consume_edge_rate(uuid, text, int, int) to service_role;
