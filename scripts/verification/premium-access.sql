-- All fixtures, grants and payment records are rolled back.
begin;
do $$
declare owner_id uuid;u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();pid uuid:=gen_random_uuid();did uuid:=gen_random_uuid();w public.workout_logs;member public.memberships;result jsonb;code_id uuid;before_until timestamptz;set_id uuid:=gen_random_uuid();pay_count bigint;report jsonb;
begin
 select user_id into strict owner_id from public.owner_dashboard_access where enabled;
 insert into auth.users(id,email,email_confirmed_at,created_at,updated_at,raw_user_meta_data) values
 (u,u::text||'@example.invalid',now(),now(),now(),'{"name":"Premium QA","consent":true}'),
 (v,v::text||'@example.invalid',now(),now(),now(),'{"name":"Premium QA other","consent":true}');
 insert into public.memberships(user_id,kind,expires_at) values(u,'trial',now()-interval '1 day'),(v,'trial',now()-interval '1 day');
 insert into public.workout_programmes(id,client_id,name) values(pid,u,'QA existing programme');
 insert into public.programme_days(id,client_id,programme_id,name) values(did,u,pid,'QA day');
 perform set_config('request.jwt.claim.sub',u::text,true);
 set local role authenticated;
 member:=public.ensure_membership();
 if member.kind<>'free' or public.has_active_membership() then raise exception 'Expired trial must become free';end if;
 w:=public.open_workout(null);
 perform public.log_nutrition_food(gen_random_uuid(),current_date,'lunch','QA free meal',null,500);
 perform public.save_workout_session_plan(w.id,'[{"key":"nm_QA press","name":"QA press","scheme":{"sets":3,"repMin":8,"repMax":12}}]'::jsonb);
 perform public.sync_log_entry(set_id,'set',jsonb_build_object('log_id',w.id,'exercise_name','QA press','set_number',1,'weight',20,'reps',10,'rir',2));
 perform public.undo_session_set(w.id,set_id,jsonb_build_object('weight',20,'reps',10,'weight_left',null,'reps_left',null,'rir',2));
 if exists(select 1 from public.logged_sets where id=set_id) then raise exception 'Free account could not undo a set';end if;
 perform public.sync_log_entry(gen_random_uuid(),'set',jsonb_build_object('log_id',w.id,'exercise_name','QA press','set_number',1,'weight',20,'reps',10,'rir',2));
 perform public.finish_workout(w.id,1800,current_date,'[]'::jsonb);
 if not exists(select 1 from public.workout_logs where id=w.id and completed_at is not null) then raise exception 'Free workout could not finish';end if;
 begin
  insert into public.workout_programmes(client_id,name) values(u,'Blocked premium programme');
  raise exception 'Free account created a premium programme';
 exception when insufficient_privilege then null;end;
 begin
  insert into public.workout_logs(client_id,day_id) values(u,did);
  raise exception 'Free account bypassed programme-start restriction';
 exception when insufficient_privilege then null;end;
 begin
  perform public.manage_premium_code(owner_id,'list');raise exception 'Customer called owner code RPC';
 exception when insufficient_privilege then null;end;
 begin
  perform public.redeem_premium_code(v,repeat('a',64),null);raise exception 'Customer called service redemption RPC';
 exception when insufficient_privilege then null;end;
 begin
  insert into public.logged_sets(client_id,log_id,exercise_name,reps) values(v,w.id,'Other user',10);raise exception 'Cross-account set write allowed';
 exception when insufficient_privilege then null;end;
 reset role;
 select count(*) into pay_count from public.membership_payments;
 set local role service_role;
 result:=public.manage_premium_code(owner_id,'create',null,repeat('a',64),'AAAA','QA single use',30,1,30,null);code_id:=(result->>'created_id')::uuid;
 result:=public.redeem_premium_code(u,repeat('a',64),u::text||'@example.invalid');
 if result->>'ok'<>'true' then raise exception 'Valid code failed: %',result;end if;
 before_until:=(result->>'expires_at')::timestamptz;
 result:=public.redeem_premium_code(u,repeat('a',64),u::text||'@example.invalid');
 if result->>'already_redeemed'<>'true' or (result->>'expires_at')::timestamptz<>before_until then raise exception 'Redemption is not idempotent';end if;
 result:=public.redeem_premium_code(v,repeat('a',64),v::text||'@example.invalid');
 if result->>'ok'<>'false' then raise exception 'Single-use code redeemed twice';end if;
 reset role;
 if (select count(*) from public.membership_payments)<>pay_count then raise exception 'Invite changed payment ledger';end if;
 set local role authenticated;
 member:=public.ensure_membership();if member.kind<>'invite' or not public.has_active_membership() then raise exception 'Invite did not unlock premium';end if;
 w:=public.open_workout(did);
 reset role;
 set local role service_role;
 report:=public.owner_dashboard_report(owner_id,'Premium QA',0,'invite');
 if (report->>'user_count')::int<>1 then raise exception 'Invited member report failed';end if;
 perform public.manage_premium_code(owner_id,'revoke',code_id);
 reset role;
 set local role authenticated;
 if public.has_active_membership() then raise exception 'Revoked invite retained premium';end if;
 if (public.open_workout(did)).id<>w.id then raise exception 'Expiry lost in-progress session';end if;
 perform public.sync_log_entry(gen_random_uuid(),'set',jsonb_build_object('log_id',w.id,'exercise_name','QA existing press','set_number',1,'weight',30,'reps',8,'rir',2));
 perform public.finish_workout(w.id,2100,current_date,'[]'::jsonb);
 reset role;
 set local role service_role;
 result:=public.manage_premium_code(owner_id,'create',null,repeat('b',64),'BBBB','QA email',7,2,30,u::text||'@example.invalid');
 result:=public.redeem_premium_code(v,repeat('b',64),v::text||'@example.invalid');if result->>'ok'<>'false' then raise exception 'Email restriction bypassed';end if;
 result:=public.redeem_premium_code(u,repeat('b',64),u::text||'@example.invalid');if result->>'ok'<>'true' then raise exception 'Email code blocked recipient';end if;
 before_until:=(result->>'expires_at')::timestamptz;
 reset role;
 insert into public.membership_payments(checkout_id,user_id,amount,currency,mode) values('premium-qa-'||u,u,10000,'ZAR','live');
 set local role service_role;
 perform public.confirm_yoco_payment('premium-qa-'||u,'qa-payment-'||u,'live');
 reset role;
 if (select expires_at from public.memberships where user_id=u)<>before_until+interval '30 days' then raise exception 'Payment did not extend invited access';end if;
 set local role service_role;
 for i in 1..12 loop result:=public.redeem_premium_code(v,repeat('c',64),v::text||'@example.invalid');end loop;
 if result->>'error' not like 'Too many attempts%' then raise exception 'Redemption rate limit failed';end if;
 reset role;
 if has_table_privilege('authenticated','public.premium_access_codes','select') or has_table_privilege('anon','public.premium_access_grants','insert') then raise exception 'Code permissions leaked';end if;
end $$;
select 'Free logging, premium enforcement, invite redemption, usage/email limits, revocation, in-progress recovery, billing extension and rate limits passed' as verification;
rollback;
