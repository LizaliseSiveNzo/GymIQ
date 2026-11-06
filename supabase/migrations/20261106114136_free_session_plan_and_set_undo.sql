-- Core in-session editing is available to free accounts; all ownership and conflict checks remain.
CREATE OR REPLACE FUNCTION public.save_workout_session_plan(p_log uuid, p_plan jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare w public.workout_logs; i jsonb; ex public.exercises; pe uuid; eid uuid; key text; canonical jsonb:='[]'; seen text[]:='{}';
begin
 if auth.uid() is null then raise exception 'Sign in first';end if;
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
end $function$
;
CREATE OR REPLACE FUNCTION public.undo_session_set(p_log uuid, p_set uuid, p_expected jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare w public.workout_logs; s public.logged_sets;
begin
 if auth.uid() is null then raise exception 'Sign in before changing a set'; end if;
 select * into w from public.workout_logs where id=p_log and client_id=auth.uid() for update;
 if not found then raise exception 'Workout not found'; end if;
 if w.completed_at is not null or w.cancelled_at is not null then raise exception 'This workout has ended. Reload your history before changing its sets.'; end if;
 select * into s from public.logged_sets where id=p_set and log_id=w.id and client_id=auth.uid() for update;
 if not found then return true; end if; -- A lost undo acknowledgement can retry safely.
 if p_expected is distinct from jsonb_build_object('weight',s.weight,'reps',s.reps,'weight_left',s.weight_left,'reps_left',s.reps_left,'rir',s.rir) then
  raise exception 'This set changed elsewhere. Reload the session before undoing it.';
 end if;
 delete from public.logged_sets where id=s.id and log_id=w.id and client_id=auth.uid();
 -- Immutable sync receipts are deliberately retained, preventing resurrection.
 return true;
end $function$
;
