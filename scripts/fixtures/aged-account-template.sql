begin;
set local statement_timeout='60s';
do $fixture$
declare
 p jsonb:=$aged_fixture$__PAYLOAD__$aged_fixture$;
 uid uuid:=(p->>'user_id')::uuid; tag text:=p->>'tag'; w jsonb; e jsonb; d jsonb; m jsonb; f jsonb; v jsonb;
 lid uuid; eid uuid; pe uuid; started timestamptz; ordinal integer; j integer; exindex integer; reps integer; kg numeric; leftkg numeric; leftreps integer;
 working integer; warm boolean; cancelled boolean; affected integer;
begin
 if not exists(select 1 from public.users where id=uid and lower(email)=lower(p->>'email')) then raise exception 'Target account mismatch';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||tag,0));
 if exists(select 1 from public.workout_logs where client_id=uid and note like tag||'%') then raise exception 'This mock batch already exists; do not duplicate it';end if;
 if (p->>'end')::date>=current_date then raise exception 'Mock data must end before today';end if;
 for v in select value from jsonb_array_elements(p->'versions') loop
  insert into public.nutrition_goal_versions(user_id,effective_day,result) values(uid,(v->>'day')::date,(v->'result')||jsonb_build_object('mock_batch',tag)) on conflict do nothing;
 end loop;
 for w in select value from jsonb_array_elements(p->'workouts') loop
  lid:=(w->>'id')::uuid;started:=(w->>'created_at')::timestamptz;cancelled:=(w->>'cancelled')::boolean;
  if w->>'day_id' is not null and not exists(select 1 from public.programme_days where id=(w->>'day_id')::uuid and client_id=uid and programme_id=(p->>'programme_id')::uuid) then raise exception 'Wrong programme day';end if;
  insert into public.workout_logs(id,client_id,day_id,log_date,note,created_at,duration_sec,completed_at,cancelled_at,coach_readiness)
  values(lid,uid,(w->>'day_id')::uuid,(w->>'day')::date,tag||' · '||case when cancelled then 'cancelled' when (w->>'deload')::boolean then 'lighter week' when (w->>'short')::boolean then 'shortened session' else 'imported training history' end,
   started,(w->>'duration')::int,case when not cancelled then started+make_interval(secs=>(w->>'duration')::int) end,case when cancelled then started+make_interval(secs=>(w->>'duration')::int) end,w->>'readiness');
  exindex:=0;
  for e in select value from jsonb_array_elements(w->'exercises') loop
   eid:=(e->>'id')::uuid;pe:=(e->>'pe')::uuid;kg:=(e->>'kg')::numeric;warm:=(e->>'warmup')::boolean;
   if not exists(select 1 from public.exercises where id=eid and name=e->>'name') then raise exception 'Exercise mapping mismatch';end if;
   if pe is not null and not exists(select 1 from public.programme_exercises where id=pe and day_id=(w->>'day_id')::uuid and client_id=uid and exercise_id=eid) then raise exception 'Wrong exercise owner/day';end if;
   if warm and not cancelled then
    insert into public.logged_sets(id,client_id,log_id,exercise_name,exercise_id,programme_exercise_id,set_number,weight,reps,rir,set_type,completed,created_at,weight_left,reps_left)
    values(md5(tag||':set:'||lid||':'||eid||':warmup:1')::uuid,uid,lid,e->>'name',eid,pe,1,round(kg/2),8,5,'warmup',true,started+make_interval(mins=>exindex*7),case when (e->>'unilateral')::boolean then round(kg/2) end,case when (e->>'unilateral')::boolean then 8 end);
   end if;
   working:=jsonb_array_length(e->'reps');
   for j in 0..working-1 loop
    ordinal:=j+1+case when warm and not cancelled then 1 else 0 end;reps:=((e->'reps')->>j)::int;
    leftkg:=case when (e->>'unilateral')::boolean then kg end;
    leftreps:=case when (e->>'unilateral')::boolean then greatest(1,reps-case when j=working-1 and extract(doy from (w->>'day')::date)::int%11=0 then 1 else 0 end) end;
    insert into public.logged_sets(id,client_id,log_id,exercise_name,exercise_id,programme_exercise_id,set_number,weight,reps,rir,set_type,completed,created_at,weight_left,reps_left,target_weight,target_rep_min,target_rep_max,target_rir)
    values(md5(tag||':set:'||lid||':'||eid||':normal:'||ordinal)::uuid,uid,lid,e->>'name',eid,pe,ordinal,kg,reps,(e->>'rir')::int,'normal',true,
     started+make_interval(mins=>exindex*7+j*2+1),leftkg,leftreps,kg,(e->>'lo')::int,(e->>'hi')::int,2);
   end loop;
   if not cancelled then
    insert into public.exercise_coach_feedback(user_id,log_id,exercise_key,exercise_id,exercise_name,effort,updated_at)
    values(uid,lid,eid::text,eid,e->>'name',case when w->>'readiness' in ('tired','sore') then 'hard' when extract(doy from (w->>'day')::date)::int%8=0 then 'easy' else 'right' end,started+make_interval(secs=>(w->>'duration')::int));
   end if;
   exindex:=exindex+1;
  end loop;
 end loop;
 for d in select value from jsonb_array_elements(p->'foodDays') loop
  m:=(p->'menus')->((d->>'menu')::int);
  insert into public.nutrition_meal_plans(user_id,day,plan,source,target,created_at)
  values(uid,(d->>'day')::date,(select jsonb_agg(value||jsonb_build_object('mock_batch',tag)) from jsonb_array_elements(m->'meals')),'rules',(m->>'target')::int,((d->>'day')||'T05:00:00+02:00')::timestamptz) on conflict do nothing;
  j:=0;
  for f in select value from jsonb_array_elements(d->'intake') loop
   insert into public.calorie_transactions(id,user_id,occurred_at,created_at,kind,kcal,label,log_day,meal_slot,meal_snapshot)
   values(md5(tag||':food:'||(d->>'day')||':'||j)::uuid,uid,((d->>'day')||'T'||lpad(f->>'hour',2,'0')||':00:00+02:00')::timestamptz,
    ((d->>'day')||'T'||lpad(f->>'hour',2,'0')||':00:00+02:00')::timestamptz,'food',-round((f->>'kcal')::numeric)::int,left('[Mock90d] '||(f->>'name'),100),(d->>'day')::date,f->>'slot',
    case when jsonb_typeof(f->'items')='array' then jsonb_build_object('items',f->'items','mock_batch',tag) else jsonb_build_object('mock_batch',tag) end);
   j:=j+1;
  end loop;
  if (d->>'complete')::boolean then insert into public.nutrition_day_status(user_id,day,complete) values(uid,(d->>'day')::date,true) on conflict do nothing;end if;
 end loop;
 for d in select value from jsonb_array_elements(p->'weights') loop
  insert into public.body_metrics(id,client_id,metric_date,weight_kg,note) values((d->>'id')::uuid,uid,(d->>'day')::date,(d->>'kg')::numeric,tag||' · synthetic morning weigh-in') on conflict(client_id,metric_date) do nothing;
 end loop;
 for d in select value from jsonb_array_elements(p->'rest') loop
  insert into public.workout_rest_days(user_id,programme_id,rest_date,created_at) values(uid,(p->>'programme_id')::uuid,trim(both '"' from d::text)::date,(trim(both '"' from d::text)||'T08:00:00+02:00')::timestamptz) on conflict do nothing;
 end loop;
 -- Weekly make-up suggestions are derived caches and must reflect the imported history.
 for d in select value from jsonb_array_elements(p->'weeklyPlans') loop
  insert into public.workout_week_plans(user_id,programme_id,week_start,extras,created_at)
  values(uid,(p->>'programme_id')::uuid,(d->>'week')::date,d->'extras',((d->>'week')||'T05:00:00+02:00')::timestamptz)
  on conflict(user_id,programme_id,week_start) do update set extras=excluded.extras;
 end loop;
 insert into public.habits(user_id,day,weighed_in,worked_out,logged_food)
 select uid,day::date,
 exists(select 1 from public.body_metrics where client_id=uid and metric_date=day::date),
 exists(select 1 from public.workout_logs where client_id=uid and completed_at is not null and cancelled_at is null and (completed_at at time zone 'Africa/Johannesburg')::date=day::date),
 exists(select 1 from public.calorie_transactions where user_id=uid and kind='food' and coalesce(log_day,(occurred_at at time zone 'Africa/Johannesburg')::date)=day::date)
 from generate_series((p->>'start')::date,(p->>'end')::date,interval '1 day') day where true
 on conflict(user_id,day) do update set weighed_in=public.habits.weighed_in or excluded.weighed_in,worked_out=public.habits.worked_out or excluded.worked_out,logged_food=public.habits.logged_food or excluded.logged_food;
 -- Derive PRs from real + mock eligible sets using the app's actual formulas.
 with performances as (
  select s.exercise_name,(w.completed_at at time zone 'Africa/Johannesburg')::date as day,
   greatest(coalesce(s.weight,0)*(1+coalesce(s.reps,0)/30.0),coalesce(s.weight_left,0)*(1+coalesce(s.reps_left,0)/30.0)) as e1rm,
   coalesce(s.weight,0)*coalesce(s.reps,0)+coalesce(s.weight_left,0)*coalesce(s.reps_left,0) as volume
  from public.logged_sets s join public.workout_logs w on w.id=s.log_id where s.client_id=uid and w.client_id=uid and w.completed_at is not null and w.cancelled_at is null
  and s.exercise_name in(select jsonb_array_elements_text(p->'exercise_names'))
  and s.completed=true and s.set_type<>'warmup' and (s.reps>0 or s.reps_left>0)
  and not(case when s.programme_exercise_id is not null then 'pe_'||s.programme_exercise_id::text else 'nm_'||s.exercise_name end=any(coalesce(w.excluded_exercises,'{}')))
 ), candidates as(select exercise_name,day,'e1rm'::text kind,e1rm value from performances union all select exercise_name,day,'volume',volume from performances),
 best as(select distinct on(exercise_name,kind) exercise_name,kind,round(value,2) value,day from candidates where value>0 order by exercise_name,kind,value desc,day)
 insert into public.personal_records(id,user_id,exercise_name,pr_type,value,achieved_on)
 select md5(tag||':pr:'||exercise_name||':'||kind)::uuid,uid,exercise_name,kind,value,day from best where true
 on conflict(user_id,exercise_name,pr_type) do update set value=greatest(public.personal_records.value,excluded.value),achieved_on=case when excluded.value>public.personal_records.value then excluded.achieved_on else public.personal_records.achieved_on end;
 if (select count(*) from public.workout_logs where client_id=uid and note like tag||'%')<>jsonb_array_length(p->'workouts') then raise exception 'Mock workout count mismatch';end if;
 if exists(select 1 from public.workout_logs where client_id=uid and note like tag||'%' and completed_at>now()) then raise exception 'Future workout generated';end if;
end $fixture$;
select jsonb_build_object('mock_workouts',(select count(*) from public.workout_logs where note like 'GYMIQ_MOCK_90D_20261103%'),
 'mock_sets',(select count(*) from public.logged_sets s join public.workout_logs w on w.id=s.log_id where w.note like 'GYMIQ_MOCK_90D_20261103%'),
 'mock_food',(select count(*) from public.calorie_transactions where meal_snapshot->>'mock_batch'='GYMIQ_MOCK_90D_20261103'),
 'mock_weights',(select count(*) from public.body_metrics where note like 'GYMIQ_MOCK_90D_20261103%')) as result;
__FINISH__
