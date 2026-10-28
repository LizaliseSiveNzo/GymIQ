-- Existing customers get the same one-time trial while the new frontend rolls out.
insert into public.memberships(user_id,kind,expires_at)
select id,'trial',now()+interval '7 days' from public.users on conflict(user_id) do nothing;

create function public.open_workout(p_day uuid default null) returns public.workout_logs
language plpgsql security invoker set search_path='' as $$
declare result public.workout_logs;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||coalesce(p_day::text,'free'),0));
 if p_day is not null and not exists(select 1 from public.programme_days where id=p_day and client_id=auth.uid()) then raise exception 'Workout not found'; end if;
 select * into result from public.workout_logs where client_id=auth.uid() and completed_at is null
 and ((p_day is null and note='freeform') or day_id=p_day) order by created_at desc limit 1;
 if not found then
 insert into public.workout_logs(client_id,day_id,note)
 values(auth.uid(),p_day,case when p_day is null then 'freeform' else null end) returning * into result;
 end if;
 return result;
end $$;
revoke all on function public.open_workout(uuid) from public,anon;
grant execute on function public.open_workout(uuid) to authenticated;

create function public.account_storage_objects(p_user uuid)
returns table(bucket_id text,name text) language sql stable security definer set search_path='' as $$
 select bucket_id,name from storage.objects where owner_id=p_user::text or owner=p_user;
$$;
revoke all on function public.account_storage_objects(uuid) from public,anon,authenticated;
grant execute on function public.account_storage_objects(uuid) to service_role;
