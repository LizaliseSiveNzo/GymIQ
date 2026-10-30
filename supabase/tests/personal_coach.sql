-- Run with a SQL admin connection. Every fixture and change is rolled back.
-- Uses the existing disposable layout QA identity; never creates an auth account.
begin;
do $$ declare uid uuid; tid uuid:=gen_random_uuid(); aid uuid:=gen_random_uuid(); mid uuid:=gen_random_uuid(); wid uuid:=gen_random_uuid(); baseline jsonb; generated jsonb; count_before int;
begin
 select id into uid from auth.users where email='gymiq-layout-qa-20261029@example.invalid';
 if uid is null then raise exception 'Layout QA fixture is required'; end if;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 insert into public.personal_coach_access(user_id) values(uid);
 insert into public.coach_settings(user_id,pantry,equipment) values(uid,array['171477'],array(select id from public.equipment_items));
 insert into public.nutrition_goals(user_id,settings,result) values(uid,'{}','{"target":2200}');
 select jsonb_build_object('settings',jsonb_build_object('pantry',s.pantry,'equipment',s.equipment),'goal_updated_at',g.updated_at,'plan_created_at',null,'offset',0,'programme_id',(select id from public.workout_programmes where client_id=uid and is_active limit 1)) into baseline from public.coach_settings s join public.nutrition_goals g on g.user_id=s.user_id where s.user_id=uid;
 insert into public.coach_turns(id,user_id,prompt,status,reply) values(tid,uid,'Transactional coach verification','done','Synthetic test');
 insert into public.coach_actions(id,user_id,turn_id,kind,payload,baseline) values(aid,uid,tid,'meal','{"name":"Coach test chicken","slot":"lunch","items":[{"food_id":"171477","grams":150}]}',baseline);
 insert into public.coach_actions(id,user_id,turn_id,kind,payload,baseline) values(mid,uid,tid,'meal_plan',jsonb_build_object('day',current_date,'target',2200,'meals','[]'::jsonb),baseline);
 select jsonb_build_object('goal','hypertrophy','split','full_body','daysPerWeek',1,'sessionMinutes',45,'deloadPolicy','every_4w','weeks',jsonb_build_array(jsonb_build_object('weekNumber',1,'kind','accumulate','volumeMultiplier',1)),'days',jsonb_build_array(jsonb_build_object('dayIndex',0,'label','A','name','Test day','exercises',(select jsonb_agg(jsonb_build_object('exerciseId',e.id,'name',e.name,'sets',2,'repMin',8,'repMax',12,'rir',2,'restSeconds',90,'pattern',e.movement_pattern,'sort',0)) from (select * from public.exercises where is_custom=false order by id limit 2)e)))) into generated;
 insert into public.coach_actions(id,user_id,turn_id,kind,payload,baseline) values(wid,uid,tid,'workout',jsonb_build_object('name','Coach transaction test','generated',generated),baseline);
 perform set_config('gymiq.test.meal',aid::text,true);perform set_config('gymiq.test.plan',mid::text,true);perform set_config('gymiq.test.workout',wid::text,true);
 select count(*) into count_before from public.logged_sets where client_id=uid;perform set_config('gymiq.test.sets',count_before::text,true);
end $$;
set local role authenticated;
do $$ declare aid uuid:=current_setting('gymiq.test.meal')::uuid; mid uuid:=current_setting('gymiq.test.plan')::uuid; wid uuid:=current_setting('gymiq.test.workout')::uuid;
begin
 if has_table_privilege('authenticated','public.coach_actions','INSERT') then raise exception 'Forged proposal permission'; end if;
 if has_function_privilege('authenticated','public.reserve_coach_turn(uuid,uuid,text)','EXECUTE') then raise exception 'Reservation bypass'; end if;
 perform public.apply_coach_action(aid,false);perform public.apply_coach_action(aid,false);
 if (select count(*) from public.saved_meals where id=aid)<>1 then raise exception 'Meal idempotency failed'; end if;
 perform public.apply_coach_action(mid,false);
 if not exists(select 1 from public.nutrition_meal_plans where user_id=auth.uid() and day=current_date and source='deepseek') then raise exception 'Plan apply failed'; end if;
 perform public.apply_coach_action(wid,false);perform public.apply_coach_action(wid,false);
 if (select count(*) from public.workout_programmes where client_id=auth.uid() and is_active)<>1 then raise exception 'Programme activation failed'; end if;
 if (select count(*) from public.programme_exercises where day_id in(select id from public.programme_days where programme_id=wid))<>2 then raise exception 'Exercise persistence failed'; end if;
 if (select count(*) from public.logged_sets where client_id=auth.uid())<>current_setting('gymiq.test.sets')::int then raise exception 'History changed'; end if;
 begin insert into public.coach_actions(id,user_id,turn_id,kind,payload,baseline) values(gen_random_uuid(),auth.uid(),gen_random_uuid(),'meal','{}','{}');raise exception 'Browser forged an action'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
