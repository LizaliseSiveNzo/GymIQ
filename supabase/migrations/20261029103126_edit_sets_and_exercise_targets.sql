-- Planned defaults are kept separate from performed sets and PRs.
create table public.exercise_targets (
 user_id uuid not null references public.users(id) on delete cascade,
 exercise_key text not null check(length(exercise_key)<=255),
 exercise_id uuid references public.exercises(id) on delete cascade,
 exercise_name text not null check(length(btrim(exercise_name)) between 1 and 200),
 weight numeric(8,2) not null check(weight>=0 and weight<10000),
 reps integer not null check(reps between 1 and 1000),
 updated_at timestamptz not null default now(),
 primary key(user_id,exercise_key),
 check((exercise_id is not null and exercise_key=exercise_id::text) or
       (exercise_id is null and exercise_key='name:'||lower(btrim(exercise_name))))
);
create index idx_exercise_targets_exercise on public.exercise_targets(exercise_id);
alter table public.exercise_targets enable row level security;
grant select,insert,update,delete on public.exercise_targets to authenticated;
revoke all on public.exercise_targets from anon;
create policy targets_owner_select on public.exercise_targets for select to authenticated using(user_id=(select auth.uid()));
create policy targets_owner_delete on public.exercise_targets for delete to authenticated using(user_id=(select auth.uid()));
create policy targets_owner_insert on public.exercise_targets for insert to authenticated with check(
 user_id=(select auth.uid()) and (exercise_id is null or exists(select 1 from public.exercises e where e.id=exercise_targets.exercise_id and (e.owner_user_id is null or e.owner_user_id=(select auth.uid())))));
create policy targets_owner_update on public.exercise_targets for update to authenticated using(user_id=(select auth.uid())) with check(
 user_id=(select auth.uid()) and (exercise_id is null or exists(select 1 from public.exercises e where e.id=exercise_targets.exercise_id and (e.owner_user_id is null or e.owner_user_id=(select auth.uid())))));

-- Rebuild cached records so lowering an incorrectly logged load also lowers its PR.
create function public.refresh_exercise_records(p_name text) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':records:'||p_name,0));
 delete from public.personal_records where user_id=auth.uid() and exercise_name=p_name and pr_type in ('e1rm','volume');
 insert into public.personal_records(user_id,exercise_name,pr_type,value,achieved_on)
 with valid as (
  select s.*,w.completed_at from public.logged_sets s join public.workout_logs w on w.id=s.log_id
  where s.client_id=auth.uid() and w.client_id=auth.uid() and s.exercise_name=p_name
  and s.completed is true and s.set_type<>'warmup' and w.completed_at is not null and w.cancelled_at is null
  and not ((case when s.programme_exercise_id is not null then 'pe_'||s.programme_exercise_id::text else 'nm_'||s.exercise_name end)=any(w.excluded_exercises))
 ), candidates as (
  select 'e1rm' as kind,round(c.weight*(1+c.reps/30.0),2) as value,v.completed_at
  from valid v cross join lateral (values(v.weight,v.reps),(v.weight_left,v.reps_left)) c(weight,reps)
  where c.weight>0 and c.reps>0
  union all
  select 'volume',coalesce(v.weight,0)*coalesce(v.reps,0)+coalesce(v.weight_left,0)*coalesce(v.reps_left,0),v.completed_at from valid v
 ), bests as (
  select distinct on(kind) kind,value,completed_at from candidates where value>0 order by kind,value desc,completed_at asc
 ) select auth.uid(),p_name,kind,value,completed_at::date from bests;
end $$;
revoke all on function public.refresh_exercise_records(text) from public,anon;
grant execute on function public.refresh_exercise_records(text) to authenticated;

create function public.edit_workout_set(p_set uuid,p_weight numeric,p_reps integer,p_weight_left numeric default null,p_reps_left integer default null,p_rir integer default null,p_expected jsonb default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare old_set public.logged_sets; edited public.logged_sets; workout public.workout_logs;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if p_weight is null or p_weight<0 or p_weight>=10000 or p_weight::text in ('NaN','Infinity','-Infinity') or p_reps is null or p_reps<1 or p_reps>1000 then raise exception 'Use a weight of zero or more and 1–1000 whole reps'; end if;
 if (p_weight_left is null)<>(p_reps_left is null) or (p_weight_left is not null and (p_weight_left<0 or p_weight_left>=10000 or p_weight_left::text in ('NaN','Infinity','-Infinity') or p_reps_left<1 or p_reps_left>1000)) then raise exception 'Enter both left-side weight and reps'; end if;
 if p_rir is not null and (p_rir<0 or p_rir>10) then raise exception 'RIR must be between 0 and 10'; end if;
 select * into old_set from public.logged_sets where id=p_set and client_id=auth.uid();
 if not found then raise exception 'Set not found'; end if;
 select * into workout from public.workout_logs where id=old_set.log_id and client_id=auth.uid() for update;
 if not found or workout.cancelled_at is not null then raise exception 'Restore the cancelled workout before editing its sets'; end if;
 select * into old_set from public.logged_sets where id=p_set and client_id=auth.uid() for update;
 if not found then raise exception 'Set not found'; end if;
 if p_expected is not null and (
  old_set.weight is distinct from (p_expected->>'weight')::numeric or old_set.reps is distinct from (p_expected->>'reps')::int or
  old_set.weight_left is distinct from (p_expected->>'weight_left')::numeric or old_set.reps_left is distinct from (p_expected->>'reps_left')::int or old_set.rir is distinct from (p_expected->>'rir')::int
 ) then raise exception 'This set changed in another session. Reload it before saving'; end if;
 update public.logged_sets set weight=p_weight,reps=p_reps,weight_left=p_weight_left,reps_left=p_reps_left,rir=p_rir
 where id=p_set and client_id=auth.uid() returning * into edited;
 if not found then raise exception 'Could not update this set. Check your membership and try again'; end if;
 if workout.completed_at is not null then perform public.refresh_exercise_records(edited.exercise_name); end if;
 return to_jsonb(edited)||jsonb_build_object('completed_at',workout.completed_at);
end $$;
revoke all on function public.edit_workout_set(uuid,numeric,integer,numeric,integer,integer,jsonb) from public,anon;
grant execute on function public.edit_workout_set(uuid,numeric,integer,numeric,integer,integer,jsonb) to authenticated;

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
 for record_row in select distinct exercise_name from public.logged_sets where log_id=p_log and client_id=auth.uid() order by exercise_name loop
   perform public.refresh_exercise_records(record_row.exercise_name);
 end loop;
end $$;
revoke all on function public.finish_workout(uuid,int,date,jsonb) from public,anon;
grant execute on function public.finish_workout(uuid,int,date,jsonb) to authenticated;
