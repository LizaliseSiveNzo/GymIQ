do $$
begin
 if not exists(select 1 from pg_constraint where conrelid='public.users'::regclass and confrelid='auth.users'::regclass and contype='f') then
 alter table public.users add constraint users_auth_launch_cascade foreign key(id) references auth.users(id) on delete cascade not valid;
 end if;
end $$;
create function public.calorie_bank_summary() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'balance',coalesce(sum(kcal),0),
 'deposited',coalesce(sum(kcal) filter(where kind='deposit' and occurred_at>=date_trunc('month',now())),0),
 'spent',coalesce(sum(abs(kcal)) filter(where kind='food' and occurred_at>=date_trunc('month',now())),0),
 'earned',coalesce(sum(kcal) filter(where kind='exercise' and occurred_at>=date_trunc('month',now())),0))
 from public.calorie_transactions where user_id=(select auth.uid());
$$;
revoke all on function public.calorie_bank_summary() from public,anon;
grant execute on function public.calorie_bank_summary() to authenticated;
create or replace function public.ensure_month_deposit(uid uuid) returns void
language plpgsql security definer set search_path='' as $$
declare dt int; mstart timestamptz; days int;
begin
 if auth.uid() is null or uid is distinct from auth.uid() then raise exception 'Not authorized'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||'calorie_deposit',0));
 select daily_target into dt from public.calorie_bank where user_id=uid;
 if dt is null then return; end if;
 mstart:=date_trunc('month',now());
 days:=extract(day from mstart+interval '1 month'-interval '1 day')::int;
 if not exists(select 1 from public.calorie_transactions where user_id=uid and kind='deposit' and occurred_at>=mstart and occurred_at<mstart+interval '1 month') then
 insert into public.calorie_transactions(user_id,occurred_at,kind,kcal,label)
 values(uid,mstart,'deposit',dt*days,'Monthly allowance — '||to_char(mstart,'Mon YYYY'));
 end if;
end $$;
revoke all on function public.ensure_month_deposit(uuid) from public,anon;
grant execute on function public.ensure_month_deposit(uuid) to authenticated;
