-- Cancellation is reversible; raw sets are retained, but excluded from records.
alter table public.workout_logs
  add column if not exists cancelled_at timestamptz,
  add column if not exists excluded_exercises text[] not null default '{}';
create index if not exists idx_workout_finished_progress on public.workout_logs(client_id, completed_at desc)
  where completed_at is not null and cancelled_at is null;

create function public.exercise_progress_sets(p_offset integer default 0, p_limit integer default 500)
returns setof jsonb language sql stable security invoker set search_path='' as $$
 select to_jsonb(s) || jsonb_build_object('completed_at',w.completed_at)
 from public.logged_sets s join public.workout_logs w on w.id=s.log_id
 where w.client_id=auth.uid() and s.client_id=auth.uid()
 and w.completed_at is not null and w.cancelled_at is null
 and s.completed is true and s.set_type <> 'warmup'
 and (coalesce(s.reps,0)>0 or coalesce(s.reps_left,0)>0)
 and not ((case when s.programme_exercise_id is not null then 'pe_'||s.programme_exercise_id::text else 'nm_'||s.exercise_name end)=any(w.excluded_exercises))
 order by w.completed_at desc,s.created_at desc,s.id desc
 limit least(greatest(p_limit,1),500) offset greatest(p_offset,0);
$$;
revoke all on function public.exercise_progress_sets(integer,integer) from public,anon;
grant execute on function public.exercise_progress_sets(integer,integer) to authenticated;

create function public.set_workout_exercise_excluded(p_log uuid,p_key text,p_excluded boolean default true)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if p_key is null or length(p_key)>512 or p_key !~ '^(pe_|nm_)' then raise exception 'Invalid exercise'; end if;
 perform 1 from public.workout_logs where id=p_log and client_id=auth.uid() and completed_at is null and cancelled_at is null for update;
 if not found then raise exception 'Open workout not found'; end if;
 update public.workout_logs set excluded_exercises=case when p_excluded then
   array_append(array_remove(excluded_exercises,p_key),p_key) else array_remove(excluded_exercises,p_key) end
 where id=p_log and client_id=auth.uid();
end $$;
revoke all on function public.set_workout_exercise_excluded(uuid,text,boolean) from public,anon;
grant execute on function public.set_workout_exercise_excluded(uuid,text,boolean) to authenticated;

create function public.cancel_workout(p_log uuid,p_restore boolean default false)
returns void language plpgsql security invoker set search_path='' as $$
declare current_log public.workout_logs;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 select * into current_log from public.workout_logs where id=p_log and client_id=auth.uid() for update;
 if not found or current_log.completed_at is not null then raise exception 'Unfinished workout not found'; end if;
 if p_restore and exists(select 1 from public.workout_logs where client_id=auth.uid() and id<>p_log
   and cancelled_at is null and completed_at is null and day_id is not distinct from current_log.day_id) then
   raise exception 'Finish or cancel your current workout before restoring this one';
 end if;
 update public.workout_logs set cancelled_at=case when p_restore then null else coalesce(cancelled_at,now()) end
 where id=p_log and client_id=auth.uid();
end $$;
revoke all on function public.cancel_workout(uuid,boolean) from public,anon;
grant execute on function public.cancel_workout(uuid,boolean) to authenticated;

create or replace function public.open_workout(p_day uuid default null) returns public.workout_logs
language plpgsql security invoker set search_path='' as $$
declare result public.workout_logs;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||coalesce(p_day::text,'free'),0));
 if p_day is not null and not exists(select 1 from public.programme_days where id=p_day and client_id=auth.uid()) then raise exception 'Workout not found'; end if;
 select * into result from public.workout_logs where client_id=auth.uid() and completed_at is null and cancelled_at is null
 and ((p_day is null and note='freeform') or day_id=p_day) order by created_at desc limit 1;
 if not found then
 insert into public.workout_logs(client_id,day_id,note)
 values(auth.uid(),p_day,case when p_day is null then 'freeform' else null end) returning * into result;
 end if;
 return result;
end $$;
revoke all on function public.open_workout(uuid) from public,anon;
grant execute on function public.open_workout(uuid) to authenticated;


-- An unfinished workout stores observed active time, never wall-clock record age.
-- Monotonic checkpoints cannot regress time or overwrite a finished workout.
create or replace function public.checkpoint_workout_duration(p_log uuid, p_duration integer)
returns integer language plpgsql security invoker set search_path = '' as $$
declare result integer;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_duration is null or p_duration < 0 or p_duration > 604800 then
    raise exception 'Invalid workout duration';
  end if;
  update public.workout_logs
    set duration_sec = greatest(coalesce(duration_sec, 0), p_duration)
    where id = p_log and client_id = auth.uid() and completed_at is null and cancelled_at is null
    returning duration_sec into result;
  if not found then raise exception 'Open workout not found'; end if;
  return result;
end $$;
revoke all on function public.checkpoint_workout_duration(uuid, integer) from public, anon;
grant execute on function public.checkpoint_workout_duration(uuid, integer) to authenticated;

-- Finish from saved sets, not client-supplied PR candidates. Lock against cancellation.
create or replace function public.finish_workout(p_log uuid,p_duration int,p_day date,p_prs jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare current_log public.workout_logs; record_row record;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 select * into current_log from public.workout_logs where id=p_log and client_id=auth.uid() for update;
 if not found or current_log.cancelled_at is not null then raise exception 'Workout not found'; end if;
 if current_log.completed_at is not null then return; end if;
 if not exists(select 1 from public.logged_sets s where s.log_id=p_log and s.client_id=auth.uid()
   and s.completed is true and s.set_type<>'warmup' and (coalesce(s.reps,0)>0 or coalesce(s.reps_left,0)>0)
   and not ((case when s.programme_exercise_id is not null then 'pe_'||s.programme_exercise_id::text else 'nm_'||s.exercise_name end)=any(current_log.excluded_exercises))) then
   raise exception 'Log at least one working set, or cancel this workout';
 end if;
 update public.workout_logs set completed_at=now(),duration_sec=greatest(0,least(coalesce(p_duration,0),604800)) where id=p_log and client_id=auth.uid();
 insert into public.habits(user_id,day,worked_out) values(auth.uid(),p_day,true)
 on conflict(user_id,day) do update set worked_out=true;
 for record_row in
   select x->>'exercise_name' as exercise_name,
    max(greatest(coalesce((x->>'weight')::numeric,0)*(1+coalesce((x->>'reps')::numeric,0)/30),coalesce((x->>'weight_left')::numeric,0)*(1+coalesce((x->>'reps_left')::numeric,0)/30))) as estimate,
    max(coalesce((x->>'weight')::numeric,0)*coalesce((x->>'reps')::numeric,0)+coalesce((x->>'weight_left')::numeric,0)*coalesce((x->>'reps_left')::numeric,0)) as volume
   from public.logged_sets s cross join lateral (select to_jsonb(s) as x) j
   where s.log_id=p_log and s.client_id=auth.uid() and s.completed is true and s.set_type<>'warmup'
   and not ((case when s.programme_exercise_id is not null then 'pe_'||s.programme_exercise_id::text else 'nm_'||s.exercise_name end)=any(current_log.excluded_exercises))
   group by x->>'exercise_name'
 loop
   insert into public.personal_records(user_id,exercise_name,pr_type,value,achieved_on)
   select auth.uid(),record_row.exercise_name,v.kind,round(v.value,2),p_day
   from (values('e1rm',record_row.estimate),('volume',record_row.volume)) v(kind,value) where v.value>0
   on conflict(user_id,exercise_name,pr_type) do update set
    value=greatest(public.personal_records.value,excluded.value),
    achieved_on=case when excluded.value>public.personal_records.value then excluded.achieved_on else public.personal_records.achieved_on end;
 end loop;
end $$;
revoke all on function public.finish_workout(uuid,int,date,jsonb) from public,anon;
grant execute on function public.finish_workout(uuid,int,date,jsonb) to authenticated;
