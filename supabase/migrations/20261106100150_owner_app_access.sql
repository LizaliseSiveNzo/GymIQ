-- Owner access is controlled by the existing server-managed registry, not a
-- client-editable profile role. Only the caller's own boolean is exposed.
create function public.owner_has_app_access() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.owner_dashboard_access where user_id=auth.uid() and enabled);
$$;
revoke all on function public.owner_has_app_access() from public,anon;
grant execute on function public.owner_has_app_access() to authenticated;

create or replace function public.ensure_membership() returns public.memberships language plpgsql security definer set search_path='' as $$
declare result public.memberships;
begin
 if auth.uid() is null then raise exception 'Sign in first';end if;
 if public.owner_has_app_access() then
  -- Presentation-only access record; never create a payment or change the ledger.
  result.user_id:=auth.uid();result.kind:='owner';result.expires_at:='9999-12-31T00:00:00Z'::timestamptz;
  select coalesce((select created_at from public.memberships where user_id=auth.uid()),now()) into result.created_at;
  return result;
 end if;
 insert into public.memberships(user_id,kind,expires_at) values(auth.uid(),'trial',now()+interval '7 days') on conflict(user_id) do nothing;
 select * into result from public.memberships where user_id=auth.uid();return result;
end $$;
revoke all on function public.ensure_membership() from public,anon;
grant execute on function public.ensure_membership() to authenticated;

create or replace function public.has_active_membership() returns boolean language sql stable security invoker set search_path='' as $$
 select public.owner_has_app_access() or exists(select 1 from public.memberships where user_id=auth.uid() and expires_at>now());
$$;
revoke all on function public.has_active_membership() from public,anon;
grant execute on function public.has_active_membership() to authenticated;
