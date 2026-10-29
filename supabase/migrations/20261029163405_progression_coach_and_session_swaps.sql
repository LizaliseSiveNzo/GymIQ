alter table public.workout_logs add column coach_readiness text not null default 'ready' check(coach_readiness in ('ready','tired','sore')),
 add column session_plan jsonb check(session_plan is null or (jsonb_typeof(session_plan)='array' and jsonb_array_length(session_plan)<=60));
create table public.exercise_coach_preferences (
 user_id uuid not null references public.users(id) on delete cascade,
 exercise_key text not null check(length(exercise_key) between 1 and 255),
 load_increment numeric(6,2) not null check(load_increment between 0.1 and 100),
 primary key(user_id,exercise_key)
);
alter table public.exercise_coach_preferences enable row level security;
create policy coach_preferences_owner on public.exercise_coach_preferences for all to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and public.has_active_membership());
grant select,insert,update,delete on public.exercise_coach_preferences to authenticated;
revoke all on public.exercise_coach_preferences from anon;
create table public.exercise_coach_feedback (
 user_id uuid not null references public.users(id) on delete cascade,
 log_id uuid not null references public.workout_logs(id) on delete cascade,
 exercise_key text not null check(length(exercise_key) between 1 and 255),
 exercise_id uuid references public.exercises(id) on delete cascade,
 exercise_name text not null check(length(exercise_name) between 1 and 200),
 effort text not null check(effort in ('easy','right','hard')),
 updated_at timestamptz not null default now(),primary key(user_id,log_id,exercise_key),
 check((exercise_id is not null and exercise_key=exercise_id::text) or (exercise_id is null and exercise_key='name:'||lower(btrim(exercise_name))))
);
alter table public.exercise_coach_feedback enable row level security;
create policy coach_feedback_read on public.exercise_coach_feedback for select to authenticated using(user_id=(select auth.uid()));
create policy coach_feedback_delete on public.exercise_coach_feedback for delete to authenticated using(user_id=(select auth.uid()));
create policy coach_feedback_insert on public.exercise_coach_feedback for insert to authenticated with check(
 user_id=(select auth.uid()) and public.has_active_membership() and exists(
 select 1 from public.workout_logs w join public.logged_sets s on s.log_id=w.id
 where w.id=exercise_coach_feedback.log_id and w.client_id=(select auth.uid()) and s.client_id=(select auth.uid()) and w.cancelled_at is null
 and s.completed=true and s.set_type<>'warmup' and (s.reps>0 or s.reps_left>0)
 and (case when exercise_coach_feedback.exercise_id is not null then s.exercise_id=exercise_coach_feedback.exercise_id else lower(btrim(s.exercise_name))=lower(btrim(exercise_coach_feedback.exercise_name)) end)
 and not(case when s.programme_exercise_id is not null then 'pe_'||s.programme_exercise_id::text else 'nm_'||s.exercise_name end=any(coalesce(w.excluded_exercises,'{}')))));
create policy coach_feedback_update on public.exercise_coach_feedback for update to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and public.has_active_membership() and exists(
 select 1 from public.workout_logs w join public.logged_sets s on s.log_id=w.id
 where w.id=exercise_coach_feedback.log_id and w.client_id=(select auth.uid()) and s.client_id=(select auth.uid()) and w.cancelled_at is null
 and s.completed=true and s.set_type<>'warmup' and (s.reps>0 or s.reps_left>0)
 and (case when exercise_coach_feedback.exercise_id is not null then s.exercise_id=exercise_coach_feedback.exercise_id else lower(btrim(s.exercise_name))=lower(btrim(exercise_coach_feedback.exercise_name)) end)
 and not(case when s.programme_exercise_id is not null then 'pe_'||s.programme_exercise_id::text else 'nm_'||s.exercise_name end=any(coalesce(w.excluded_exercises,'{}')))));
grant select,insert,update,delete on public.exercise_coach_feedback to authenticated;
revoke all on public.exercise_coach_feedback from anon;

create function public.set_workout_readiness(p_log uuid,p_readiness text) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or p_readiness is null or p_readiness not in ('ready','tired','sore') then raise exception 'Choose a valid readiness option';end if;
 update public.workout_logs set coach_readiness=p_readiness where id=p_log and client_id=auth.uid() and completed_at is null and cancelled_at is null;
 if not found then raise exception 'An active unfinished session is required';end if;
end $$;
revoke all on function public.set_workout_readiness(uuid,text) from public,anon;
grant execute on function public.set_workout_readiness(uuid,text) to authenticated;

create function public.save_workout_session_plan(p_log uuid,p_plan jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare w public.workout_logs; i jsonb; ex public.exercises; pe uuid; eid uuid; key text; canonical jsonb:='[]'; seen text[]:='{}';
begin
 if auth.uid() is null or not public.has_active_membership() then raise exception 'Active membership required';end if;
 select * into w from public.workout_logs where id=p_log and client_id=auth.uid() for update;
 if not found or w.completed_at is not null or w.cancelled_at is not null then raise exception 'An unfinished session is required';end if;
 if p_plan is null or jsonb_typeof(p_plan)<>'array' or jsonb_array_length(p_plan) not between 1 and 60 then raise exception 'Invalid session plan';end if;
 for i in select value from jsonb_array_elements(p_plan) loop
  pe:=nullif(i->>'peId','')::uuid;eid:=nullif(i->>'exerciseId','')::uuid;key:=i->>'key';
  if key is null or key=any(seen) or length(key)>255 then raise exception 'Duplicate or invalid exercise key';end if;
  seen:=array_append(seen,key);
  if pe is not null and not exists(select 1 from public.programme_exercises where id=pe and day_id=w.day_id and client_id=auth.uid()) then raise exception 'Exercise does not belong to this workout';end if;
  if eid is not null then
   select * into ex from public.exercises where id=eid and (owner_user_id is null or owner_user_id=auth.uid());
   if not found then raise exception 'Exercise unavailable';end if;
   i:=i||jsonb_build_object('name',ex.name,'laterality',ex.laterality,'equipmentIds',ex.equipment_ids);
  end if;
  if i->>'name' is null or length(btrim(i->>'name')) not between 1 and 200 or key<>(case when pe is not null then 'pe_'||pe::text else 'nm_'||(i->>'name') end) then raise exception 'Invalid exercise name or key';end if;
  if exists(select 1 from public.logged_sets s where s.log_id=p_log and s.client_id=auth.uid()
   and (case when s.programme_exercise_id is not null then 'pe_'||s.programme_exercise_id::text else 'nm_'||s.exercise_name end in (key,i->>'replacesKey'))
   and (s.exercise_id is distinct from eid or s.exercise_name is distinct from i->>'name')) then raise exception 'Remove the logged sets before changing this exercise';end if;
  if coalesce((i#>>'{scheme,sets}')::int,0) not between 1 and 12 or coalesce((i#>>'{scheme,repMin}')::int,0) not between 1 and 1000 or coalesce((i#>>'{scheme,repMax}')::int,0) not between 1 and 1000 or (i#>>'{scheme,repMin}')::int>(i#>>'{scheme,repMax}')::int then raise exception 'Check the exercise prescription';end if;
  canonical:=canonical||jsonb_build_array(i);
 end loop;
 update public.workout_logs set session_plan=canonical where id=p_log and client_id=auth.uid();
 return canonical;
end $$;
revoke all on function public.save_workout_session_plan(uuid,jsonb) from public,anon;
grant execute on function public.save_workout_session_plan(uuid,jsonb) to authenticated;
