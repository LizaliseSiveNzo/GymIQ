begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('f9010000-0000-4000-8000-000000000001','gymiq-launch-test-a@example.invalid','{"name":"Launch test A","consent":true}'),
 ('f9010000-0000-4000-8000-000000000002','gymiq-launch-test-b@example.invalid','{"name":"Launch test B","consent":true}');
set local role authenticated;
select set_config('request.jwt.claim.sub','f9010000-0000-4000-8000-000000000001',true);
do $$
declare member public.memberships; first_exp timestamptz; id1 uuid; id2 uuid; lid uuid; exported jsonb;
begin
 member:=public.ensure_membership(); first_exp:=member.expires_at;
 member:=public.ensure_membership();
 if member.expires_at<>first_exp then raise exception 'FAIL trial reset'; end if;
 if (select count(*) from public.users)<>1 then raise exception 'FAIL profile isolation'; end if;
 begin
 update public.memberships set expires_at=now()+interval '100 years';
 raise exception 'FAIL membership editable';
 exception when insufficient_privilege then null; end;
 begin
 update public.users set role='admin' where id=auth.uid();
 raise exception 'FAIL role editable';
 exception when insufficient_privilege then null; end;
 id1:=public.save_generated_program(
 '{"goal":"strength","split":"full_body","daysPerWeek":2,"sessionMinutes":45,"deloadPolicy":"never","weeks":[{"weekNumber":1,"kind":"accumulate","volumeMultiplier":1}],"days":[{"label":"A","name":"Full body","dayIndex":0,"exercises":[]}]}',
 '{"name":"Launch test programme"}','f9020000-0000-4000-8000-000000000001');
 id2:=public.save_generated_program(
 '{"days":[{}]}','{"name":"Duplicate retry"}','f9020000-0000-4000-8000-000000000001');
 if id1<>id2 or (select count(*) from public.workout_programmes)<>1 then raise exception 'FAIL programme idempotency'; end if;
 begin
 perform public.save_generated_program(
 '{"goal":"strength","split":"full_body","daysPerWeek":2,"sessionMinutes":45,"deloadPolicy":"never","weeks":[],"days":[{"label":"A","name":"Broken","dayIndex":0,"exercises":[{"exerciseId":"invalid","name":"Fail","sets":3}]}]}',
 '{"name":"Should rollback"}','f9020000-0000-4000-8000-000000000002');
 raise exception 'FAIL invalid programme accepted';
 exception when invalid_text_representation then null; end;
 if not exists(select 1 from public.workout_programmes where id=id1 and is_active) then raise exception 'FAIL old programme lost'; end if;
 lid:=(public.open_workout(null)).id;
 if lid<>(public.open_workout(null)).id then raise exception 'FAIL duplicate open workout'; end if;
 perform public.finish_workout(lid,120,current_date,'[]');
 if not exists(select 1 from public.workout_logs where id=lid and completed_at is not null) then raise exception 'FAIL workout not completed'; end if;
 insert into public.calorie_bank(user_id,daily_target) values(auth.uid(),2000);
 perform public.ensure_month_deposit(auth.uid()); perform public.ensure_month_deposit(auth.uid());
 insert into public.calorie_transactions(user_id,kind,kcal,label)
 select auth.uid(),'food',-10,'Test entry' from generate_series(1,101);
 if (select count(*) from public.calorie_transactions where kind='deposit')<>1 then raise exception 'FAIL double monthly deposit'; end if;
 if (public.calorie_bank_summary()->>'spent')::int<>1010 then raise exception 'FAIL truncated bank summary'; end if;
 exported:=public.export_my_data();
 if jsonb_array_length(exported->'users')<>1 then raise exception 'FAIL export isolation'; end if;
end $$;
select set_config('request.jwt.claim.sub','f9010000-0000-4000-8000-000000000002',true);
do $$ begin
 perform public.ensure_membership();
 if exists(select 1 from public.workout_programmes) or exists(select 1 from public.workout_logs) then raise exception 'FAIL other account sees workouts'; end if;
end $$;
reset role;
insert into public.membership_payments(checkout_id,user_id,amount,currency,mode) values('launch-test-checkout','f9010000-0000-4000-8000-000000000001',10000,'ZAR','live');
do $$
declare expires timestamptz;
begin
 perform public.confirm_yoco_payment('launch-test-checkout','launch-test-payment','live');
 select expires_at into expires from public.memberships where user_id='f9010000-0000-4000-8000-000000000001';
 perform public.confirm_yoco_payment('launch-test-checkout','launch-test-payment','live');
 if expires<>(select expires_at from public.memberships where user_id='f9010000-0000-4000-8000-000000000001') then raise exception 'FAIL webhook retry extends twice'; end if;
end $$;
update public.memberships set expires_at=now()-interval '1 day' where user_id='f9010000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','f9010000-0000-4000-8000-000000000002',true);
do $$ begin
 begin
 perform public.open_workout(null);
 raise exception 'FAIL expired membership can start workout';
 exception when insufficient_privilege then null; end;
 if (select count(*) from public.memberships)<>1 then raise exception 'FAIL membership isolation'; end if;
end $$;
reset role;
delete from auth.users where id='f9010000-0000-4000-8000-000000000001';
do $$ begin
 if exists(select 1 from public.users where id='f9010000-0000-4000-8000-000000000001') or
 exists(select 1 from public.workout_logs where client_id='f9010000-0000-4000-8000-000000000001') then raise exception 'FAIL deletion cascade'; end if;
end $$;
rollback;
select 'PASS: ownership, role protection, trial idempotency, programme atomicity/retry, session recovery, completion, export isolation, payment replay' as result;
