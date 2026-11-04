-- Report only existing GymIQ profile data; no additional permissions on Auth records.
create or replace function public.owner_dashboard_report(p_actor uuid,p_search text default '',p_page int default 0,p_status text default 'all',p_include_test boolean default false)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare answer jsonb;today date:=(now() at time zone 'Africa/Johannesburg')::date;
begin
 if p_actor is null or not exists(select 1 from public.owner_dashboard_access where user_id=p_actor and enabled) then raise exception 'Owner access required' using errcode='42501';end if;
 if p_status not in ('all','paid','trial','expired','none') or p_status is null then raise exception 'Invalid membership filter';end if;
 with people as materialized(
  select u.id,u.name,u.email,u.created_at,
   coalesce(r.source,'unknown') as source,
   exists(select 1 from public.owner_reporting_exclusions x where x.user_id=u.id)
    or exists(select 1 from public.owner_dashboard_access x where x.user_id=u.id)
    or exists(select 1 from public.workout_logs w where w.client_id=u.id and w.note like 'GYMIQ_MOCK_%') as excluded,
   m.expires_at,
   case when m.expires_at<=now() then 'expired' when m.kind='paid' and exists(select 1 from public.membership_payments p where p.user_id=u.id and p.mode='live' and p.paid_at<=now() and p.payment_id is not null) then 'paid' when m.kind='trial' then 'trial' else 'none' end as membership
  from public.users u left join public.memberships m on m.user_id=u.id left join public.signup_referrals r on r.user_id=u.id
 ), workouts as materialized(
  select w.client_id as user_id,w.completed_at as at from public.workout_logs w
  where w.completed_at<=now() and w.cancelled_at is null and coalesce(w.note,'') not like 'GYMIQ_MOCK_%'
 ), activity as materialized(
  select user_id,at from workouts union all
  select user_id,created_at from public.calorie_transactions where kind='food' and created_at<=now() and coalesce(meal_snapshot->>'mock_batch','')=''
 ), activity_days as materialized(
  select distinct user_id,(at at time zone 'Africa/Johannesburg')::date as day from activity
 ), payments as materialized(
  select p.*,row_number() over(partition by p.user_id order by p.paid_at,p.checkout_id) as purchase_number
  from public.membership_payments p join people u on u.id=p.user_id and not u.excluded
  where p.mode='live' and p.paid_at<=now() and p.payment_id is not null and p.currency='ZAR'
 ), training_totals as(select user_id,count(*) as completed_workouts from workouts group by user_id),
 activity_totals as(select user_id,max(at) as last_activity,bool_or((at at time zone 'Africa/Johannesburg')::date>=today-6) as active7,bool_or((at at time zone 'Africa/Johannesburg')::date>=today-29) as active30 from activity group by user_id),
 payment_totals as(select user_id,count(*) as live_payments from payments group by user_id),
 details as materialized(
  select u.*,a.last_activity,coalesce(w.completed_workouts,0) as completed_workouts,coalesce(p.live_payments,0) as live_payments,coalesce(a.active7,false) as active7,coalesce(a.active30,false) as active30
  from people u left join activity_totals a on a.user_id=u.id left join training_totals w on w.user_id=u.id left join payment_totals p on p.user_id=u.id
 ), filtered as materialized(
  select * from details where (p_include_test or not excluded)
  and (p_status='all' or membership=p_status)
  and (coalesce(p_search,'')='' or position(lower(left(p_search,100)) in lower(coalesce(name,'')||' '||coalesce(email,'')))>0)
 ), cohort as(
  select u.id,u.created_at from people u where not excluded and (u.created_at at time zone 'Africa/Johannesburg')::date between today-20 and today-14
 ), cohort_result as(
  select count(*) as eligible,count(*) filter(where exists(select 1 from activity_days d where d.user_id=c.id and d.day between (c.created_at at time zone 'Africa/Johannesburg')::date+7 and (c.created_at at time zone 'Africa/Johannesburg')::date+13)) as returned from cohort c
 ), summary as(
  select jsonb_build_object(
   'total_users',count(*),'signups_7d',count(*) filter(where (created_at at time zone 'Africa/Johannesburg')::date>=today-6),
   'active_7d',count(*) filter(where active7),
   'active_30d',count(*) filter(where active30),
   'paying_members',count(*) filter(where membership='paid'),'trial_members',count(*) filter(where membership='trial'),'expired_members',count(*) filter(where membership='expired'),
   'renewals_due_7d',count(*) filter(where membership='paid' and expires_at<=now()+interval '7 days'),
   'first_workout_completed',count(*) filter(where completed_workouts>0),
   'revenue_30d_cents',coalesce((select sum(amount) from payments where (paid_at at time zone 'Africa/Johannesburg')::date>=today-29),0),
   'revenue_total_cents',coalesce((select sum(amount) from payments),0),
   'renewal_payments_30d',(select count(*) from payments where purchase_number>1 and (paid_at at time zone 'Africa/Johannesburg')::date>=today-29),
   'week2_cohort',(select eligible from cohort_result),'week2_returned',(select returned from cohort_result)
  ) as value from details where not excluded
 ), signup_counts as(select (created_at at time zone 'Africa/Johannesburg')::date as day,count(*) as n from people where not excluded group by 1),
 active_counts as(select a.day,count(*) as n from activity_days a join people u on u.id=a.user_id and not u.excluded where a.day>=today-27 group by a.day),
 daily as(
  select calendar.day::date as day,coalesce(s.n,0) as signups,coalesce(a.n,0) as active
  from generate_series(today-27,today,interval '1 day') as calendar(day) left join signup_counts s on s.day=calendar.day::date left join active_counts a on a.day=calendar.day::date
 ), sources as(
  select source,count(*) as signups,count(*) filter(where membership='paid') as paying_members from people where not excluded group by source
 ), reliability as(
  select kind,sum(occurrences) as reports,count(distinct i.user_id) as affected_users from public.client_issue_days i join people u on u.id=i.user_id and not u.excluded where i.day>=today-27 group by kind
 )
 select jsonb_build_object('as_of',now(),'timezone','Africa/Johannesburg','summary',(select value from summary),
  'excluded_accounts',(select count(*) from people where excluded),
  'users',coalesce((select jsonb_agg(to_jsonb(rows)) from(select id,name,email,created_at,source,excluded,membership,expires_at,last_activity,completed_workouts,live_payments from filtered order by created_at desc,id limit 25 offset least(100000,greatest(0,coalesce(p_page,0)))*25)rows),'[]'::jsonb),
  'user_count',(select count(*) from filtered),'page',least(100000,greatest(0,coalesce(p_page,0))),
  'daily',coalesce((select jsonb_agg(to_jsonb(d) order by day) from daily d),'[]'::jsonb),
  'sources',coalesce((select jsonb_agg(to_jsonb(s) order by signups desc,source) from sources s),'[]'::jsonb),
  'reliability',coalesce((select jsonb_agg(to_jsonb(r)) from reliability r),'[]'::jsonb)) into answer;
 return answer;
end $$;
revoke all on function public.owner_dashboard_report(uuid,text,int,text,boolean) from public,anon,authenticated;
grant execute on function public.owner_dashboard_report(uuid,text,int,text,boolean) to service_role;
