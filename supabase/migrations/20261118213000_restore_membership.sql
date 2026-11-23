-- Membership gate: owners keep full access; other accounts need an active
-- membership (paid or trial) to use premium features.
create or replace function public.has_active_membership() returns boolean
language sql stable security invoker set search_path='' as $$
  select public.owner_has_app_access() or exists(select 1 from public.memberships where user_id=auth.uid() and expires_at>now());
$$;
revoke all on function public.has_active_membership() from public,anon;
grant execute on function public.has_active_membership() to authenticated;
