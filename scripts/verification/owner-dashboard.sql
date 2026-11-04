-- Database integration test: every fixture is rolled back. No real account IDs.
begin;
do $$
declare owner_id uuid; customer uuid:=gen_random_uuid();trial_user uuid:=gen_random_uuid();test_user uuid:=gen_random_uuid();baseline jsonb;report jsonb;reason text;
begin
 select user_id into strict owner_id from public.owner_dashboard_access where enabled;
 baseline:=public.owner_dashboard_report(owner_id)->'summary';
 insert into auth.users(id,email,email_confirmed_at,created_at,updated_at,raw_user_meta_data) values
 (customer,customer::text||'@example.invalid',now(),now()-interval '15 days',now(),'{"name":"Owner report fixture paid","consent":true,"referral_source":"qa-gym","role":"admin","owner":true}'),
 (trial_user,trial_user::text||'@example.invalid',now(),now()-interval '1 day',now(),'{"name":"Owner report fixture trial","consent":true,"referral_source":"https://invalid-url.example"}'),
 (test_user,test_user::text||'@example.invalid',now(),now()-interval '1 day',now(),'{"name":"Owner report fixture test","consent":true}');
 update public.users u set created_at=a.created_at from auth.users a where u.id=a.id and u.id in(customer,trial_user,test_user);
 if (select source from public.signup_referrals where user_id=customer)<>'qa-gym' or (select source from public.signup_referrals where user_id=trial_user)<>'direct' then raise exception 'Referral capture failed';end if;
 if exists(select 1 from public.owner_dashboard_access where user_id=customer) then raise exception 'Metadata escalated access';end if;
 insert into public.owner_reporting_exclusions(user_id) values(test_user);
 insert into public.memberships(user_id,kind,expires_at) values(customer,'paid',now()+interval '3 days'),(trial_user,'trial',now()+interval '6 days'),(test_user,'paid',now()+interval '5 days')
 on conflict(user_id) do update set kind=excluded.kind,expires_at=excluded.expires_at;
 insert into public.workout_logs(client_id,log_date,created_at,completed_at,duration_sec) values(customer,current_date-7,now()-interval '7 days 1 hour',now()-interval '7 days',3600),(customer,current_date-1,now()-interval '1 day 1 hour',now()-interval '1 day',3600);
 insert into public.workout_logs(client_id,log_date,created_at,completed_at,cancelled_at) values(customer,current_date-1,now()-interval '1 day',now()-interval '1 day',now());
 insert into public.calorie_transactions(user_id,kind,kcal,label,occurred_at,created_at) values(trial_user,'food',-500,'Owner report fixture',now(),now());
 insert into public.membership_payments(checkout_id,user_id,amount,currency,mode,payment_id,paid_at) values
 (customer::text||'-first',customer,10000,'ZAR','live',customer::text||'-p1',now()-interval '10 days'),
 (customer::text||'-renew',customer,10000,'ZAR','live',customer::text||'-p2',now()-interval '1 day'),
 (customer::text||'-test',customer,10000,'ZAR','test',customer::text||'-testpay',now()),
 (customer::text||'-pending',customer,10000,'ZAR','live',null,null),
 (test_user::text||'-paid',test_user,10000,'ZAR','live',test_user::text||'-p1',now());
 set local role service_role;
 report:=public.owner_dashboard_report(owner_id,'Owner report fixture');
 reset role;
 if (report->'summary'->>'total_users')::int<>(baseline->>'total_users')::int+2 then raise exception 'Customer/test exclusion failed';end if;
 if (report->'summary'->>'revenue_total_cents')::int<>(baseline->>'revenue_total_cents')::int+20000 then raise exception 'Live revenue filtering failed';end if;
 if (report->'summary'->>'renewal_payments_30d')::int<>(baseline->>'renewal_payments_30d')::int+1 then raise exception 'Renewal count failed';end if;
 if (report->'summary'->>'renewals_due_7d')::int<>(baseline->>'renewals_due_7d')::int+1 then raise exception 'Renewals due failed';end if;
 if (report->'summary'->>'active_7d')::int<>(baseline->>'active_7d')::int+2 then raise exception 'Unique activity count failed';end if;
 if (report->'summary'->>'week2_returned')::int<>(baseline->>'week2_returned')::int+1 then raise exception 'Week-two retention failed';end if;
 if jsonb_array_length(report->'daily')<>28 or (report->>'user_count')::int<>2 then raise exception 'Calendar/search filter failed';end if;
 if exists(select 1 from jsonb_array_elements(report->'users')u where u->>'id'=customer::text and (u->>'completed_workouts')::int<>2) then raise exception 'Cancelled workout counted';end if;
 if (public.owner_dashboard_report(owner_id,'Owner report fixture',0,'paid')->>'user_count')::int<>1 then raise exception 'Membership filter failed';end if;
 if (public.owner_dashboard_report(owner_id,'Owner report fixture',1)->'users')<>'[]'::jsonb then raise exception 'Pagination failed';end if;
 if (public.owner_dashboard_report(owner_id,'Owner report fixture',0,'all',true)->>'user_count')::int<>3 then raise exception 'Test inspection failed';end if;
 begin perform public.owner_dashboard_report(customer);raise exception 'Non-owner read succeeded';exception when insufficient_privilege then null;end;
 if has_function_privilege('authenticated','public.owner_dashboard_report(uuid,text,integer,text,boolean)','execute') or has_function_privilege('anon','public.owner_dashboard_report(uuid,text,integer,text,boolean)','execute') then raise exception 'Report RPC publicly callable';end if;
 if has_table_privilege('authenticated','public.owner_dashboard_access','insert') or has_table_privilege('authenticated','public.signup_referrals','select') then raise exception 'Private table grant leaked';end if;
 perform set_config('request.jwt.claim.sub',customer::text,true);
 set local role authenticated;
 perform public.record_client_issue('sync_failed');perform public.record_client_issue('sync_failed');
 reset role;
 if (select occurrences from public.client_issue_days where user_id=customer and kind='sync_failed')<>1 then raise exception 'Diagnostics rate limit failed';end if;
 raise notice 'Owner reporting: revenue, activity, retention, referrals, exclusions, search, pagination, permissions and diagnostics passed';
end $$;
select 'Owner reporting integration checks passed; fixtures rolled back' as verification;
rollback;
