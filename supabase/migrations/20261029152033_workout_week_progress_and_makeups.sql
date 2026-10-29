create table public.workout_week_plans (
 user_id uuid not null references public.users(id) on delete cascade,
 programme_id uuid not null references public.workout_programmes(id) on delete cascade,
 week_start date not null,extras jsonb not null default '[]' check(jsonb_typeof(extras)='array' and jsonb_array_length(extras)<=8),
 created_at timestamptz not null default now(),primary key(user_id,programme_id,week_start)
);
create table public.workout_rest_days (
 user_id uuid not null references public.users(id) on delete cascade,
 programme_id uuid not null references public.workout_programmes(id) on delete cascade,
 rest_date date not null,created_at timestamptz not null default now(),primary key(user_id,programme_id,rest_date)
);
do $$ declare t text;begin
 foreach t in array array['workout_week_plans','workout_rest_days'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy owner_read on public.%I for select to authenticated using ((select auth.uid())=user_id)',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
create function public.workout_week_activity(p_from date,p_to date,p_offset integer default 0)
returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'day_id',w.day_id,
 'day',(w.completed_at-make_interval(mins=>p_offset))::date,'sets',s.items) order by w.completed_at),'[]')
 from public.workout_logs w cross join lateral(
 select jsonb_agg(jsonb_build_object('exercise_id',s.exercise_id,'name',s.exercise_name,'programme_exercise_id',s.programme_exercise_id)) items
 from public.logged_sets s where s.log_id=w.id and s.client_id=auth.uid() and s.completed=true
 and s.set_type<>'warmup' and (s.reps>0 or s.reps_left>0)
 and not(case when s.programme_exercise_id is not null then 'pe_'||s.programme_exercise_id::text else 'nm_'||s.exercise_name end=any(coalesce(w.excluded_exercises,'{}')))
 ) s where w.client_id=auth.uid() and w.cancelled_at is null and w.completed_at is not null and w.completed_at<=now()
 and (w.completed_at-make_interval(mins=>p_offset))::date between p_from and p_to
 and p_to-p_from between 0 and 20 and p_offset between -840 and 840 and s.items is not null;
$$;
revoke all on function public.workout_week_activity(date,date,integer) from public,anon;
grant execute on function public.workout_week_activity(date,date,integer) to authenticated;
