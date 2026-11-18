-- TEMPORARY FREE MODE (revert later): disable the membership gate so the app
-- can be developed and tested without an active membership. To restore the
-- paid mechanic, revert this function to check public.memberships expiry.
create or replace function public.has_active_membership() returns boolean
language sql stable security invoker set search_path='' as $$
  select auth.uid() is not null;
$$;
revoke all on function public.has_active_membership() from public,anon;
grant execute on function public.has_active_membership() to authenticated;
