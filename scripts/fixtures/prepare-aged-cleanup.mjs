import {readFile,writeFile} from 'node:fs/promises';
import {seedId} from './generate-aged-account.mjs';
const before=JSON.parse(await readFile('artifacts/aged-account/before.json','utf8')),data=JSON.parse(await readFile('artifacts/aged-account/data.json','utf8'));
const cleanup={user_id:data.user_id,email:data.email,tag:data.tag,start:data.start,end:data.end,programme_id:data.programme_id,
 foodIds:data.foodDays.flatMap(d=>d.intake.map((_,i)=>seedId(`food:${d.day}:${i}`))),weightIds:data.weights.map(w=>w.id),rest:data.rest,
 weeklyPlans:data.weeklyPlans,beforeWeekPlans:before.weekPlans,beforeHabits:before.habits,beforePrs:before.prs,
 exerciseNames:[...new Set(data.workouts.flatMap(w=>w.exercises.map(e=>e.name)))]};
const encoded=JSON.stringify(cleanup);if(encoded.includes('$aged_cleanup$'))throw Error('Invalid cleanup delimiter');
const sql=`-- Prepared only. Run on an explicit request to remove this mock batch.
begin;
set local statement_timeout='60s';
do $cleanup$
declare p jsonb:=$aged_cleanup$${encoded}$aged_cleanup$; uid uuid:=(p->>'user_id')::uuid; d jsonb; previous jsonb;
begin
 if not exists(select 1 from public.users where id=uid and lower(email)=lower(p->>'email')) then raise exception 'Account mismatch';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||(p->>'tag'),0));
 delete from public.exercise_coach_feedback where user_id=uid and log_id in(select id from public.workout_logs where client_id=uid and note like (p->>'tag')||'%');
 delete from public.logged_sets where client_id=uid and log_id in(select id from public.workout_logs where client_id=uid and note like (p->>'tag')||'%');
 delete from public.workout_logs where client_id=uid and note like (p->>'tag')||'%';
 delete from public.calorie_transactions where user_id=uid and id in(select value::uuid from jsonb_array_elements_text(p->'foodIds'));
 delete from public.body_metrics where client_id=uid and id in(select value::uuid from jsonb_array_elements_text(p->'weightIds'));
 delete from public.nutrition_goal_versions where user_id=uid and result->>'mock_batch'=p->>'tag';
 delete from public.nutrition_meal_plans m where user_id=uid and exists(select 1 from jsonb_array_elements(m.plan) v where v->>'mock_batch'=p->>'tag');
 delete from public.workout_rest_days where user_id=uid and programme_id=(p->>'programme_id')::uuid and rest_date in(select value::date from jsonb_array_elements_text(p->'rest'));
 for d in select value from jsonb_array_elements(p->'weeklyPlans') loop
  select value into previous from jsonb_array_elements(p->'beforeWeekPlans') where value->>'week_start'=d->>'week' and value->>'programme_id'=p->>'programme_id';
  if previous is not null then
   update public.workout_week_plans set extras=previous->'extras' where user_id=uid and programme_id=(p->>'programme_id')::uuid and week_start=(d->>'week')::date and extras=d->'extras';
  else
   delete from public.workout_week_plans where user_id=uid and programme_id=(p->>'programme_id')::uuid and week_start=(d->>'week')::date and extras=d->'extras';
  end if;
 end loop;
 -- Restore original habit flags while retaining any genuine activity added later.
 insert into public.habits(user_id,day,weighed_in,worked_out,logged_food)
 select uid,dt::date,
 exists(select 1 from jsonb_array_elements(p->'beforeHabits') h where h->>'day'=dt::date::text and (h->>'weighed_in')::boolean) or exists(select 1 from public.body_metrics where client_id=uid and metric_date=dt::date),
 exists(select 1 from jsonb_array_elements(p->'beforeHabits') h where h->>'day'=dt::date::text and (h->>'worked_out')::boolean) or exists(select 1 from public.workout_logs where client_id=uid and completed_at is not null and cancelled_at is null and (completed_at at time zone 'Africa/Johannesburg')::date=dt::date),
 exists(select 1 from jsonb_array_elements(p->'beforeHabits') h where h->>'day'=dt::date::text and (h->>'logged_food')::boolean) or exists(select 1 from public.calorie_transactions where user_id=uid and kind='food' and coalesce(log_day,(occurred_at at time zone 'Africa/Johannesburg')::date)=dt::date)
 from generate_series((p->>'start')::date,(p->>'end')::date,interval '1 day') dt where true
 on conflict(user_id,day) do update set weighed_in=excluded.weighed_in,worked_out=excluded.worked_out,logged_food=excluded.logged_food;
 delete from public.habits h where user_id=uid and day between (p->>'start')::date and (p->>'end')::date and not weighed_in and not worked_out and not logged_food and not exists(select 1 from jsonb_array_elements(p->'beforeHabits') b where b->>'day'=h.day::text);
 -- Rebuild only affected PR keys from retained genuine sets plus pre-seed PRs.
 create temporary table aged_remaining_prs on commit drop as
 with performances as(
  select s.exercise_name,(w.completed_at at time zone 'Africa/Johannesburg')::date as day,
   greatest(coalesce(s.weight,0)*(1+coalesce(s.reps,0)/30.0),coalesce(s.weight_left,0)*(1+coalesce(s.reps_left,0)/30.0)) e1rm,
   coalesce(s.weight,0)*coalesce(s.reps,0)+coalesce(s.weight_left,0)*coalesce(s.reps_left,0) volume
  from public.logged_sets s join public.workout_logs w on w.id=s.log_id where s.client_id=uid and w.client_id=uid and w.completed_at is not null and w.cancelled_at is null and s.completed=true and s.set_type<>'warmup' and (s.reps>0 or s.reps_left>0)
  and not(case when s.programme_exercise_id is not null then 'pe_'||s.programme_exercise_id::text else 'nm_'||s.exercise_name end=any(coalesce(w.excluded_exercises,'{}')))
 ), candidates as(
  select exercise_name,day,'e1rm'::text kind,e1rm value from performances union all select exercise_name,day,'volume',volume from performances
  union all select v->>'exercise_name',(v->>'achieved_on')::date,v->>'pr_type',(v->>'value')::numeric from jsonb_array_elements(p->'beforePrs') v
 ) select distinct on(exercise_name,kind) exercise_name,kind,round(value,2) value,day from candidates where value>0 order by exercise_name,kind,value desc,day;
 delete from public.personal_records r where user_id=uid and exercise_name in(select value from jsonb_array_elements_text(p->'exerciseNames')) and not exists(select 1 from aged_remaining_prs x where x.exercise_name=r.exercise_name and x.kind=r.pr_type);
 insert into public.personal_records(user_id,exercise_name,pr_type,value,achieved_on)
 select uid,x.exercise_name,x.kind,x.value,x.day from aged_remaining_prs x where x.exercise_name in(select value from jsonb_array_elements_text(p->'exerciseNames'))
 on conflict(user_id,exercise_name,pr_type) do update set value=excluded.value,achieved_on=excluded.achieved_on;
end $cleanup$;
commit;
`;
await writeFile('artifacts/aged-account/remove-mock-data.sql',sql);
console.log(JSON.stringify({cleanupPrepared:true,foodIds:cleanup.foodIds.length,weightIds:cleanup.weightIds.length}));
