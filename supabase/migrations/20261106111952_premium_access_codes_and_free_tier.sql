-- Promotional codes are bearer secrets: only SHA-256 hashes are stored.
create table public.premium_access_codes(
 id uuid primary key default gen_random_uuid(),code_hash text not null unique check(code_hash ~ '^[a-f0-9]{64}$'),hint text not null,
 label text not null check(length(label) between 1 and 80),days int not null check(days between 1 and 365),
 max_uses int not null check(max_uses between 1 and 100),uses int not null default 0 check(uses>=0),
 bound_email text,expires_at timestamptz not null,revoked_at timestamptz,created_at timestamptz not null default now(),
 created_by uuid not null references auth.users(id) on delete cascade
);
create table public.premium_access_grants(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.users(id) on delete cascade,
 code_id uuid not null references public.premium_access_codes(id) on delete cascade,
 expires_at timestamptz not null,created_at timestamptz not null default now(),unique(user_id,code_id)
);
create index premium_grants_user_expiry on public.premium_access_grants(user_id,expires_at desc);
create table public.access_code_attempts(user_id uuid not null references public.users(id) on delete cascade,bucket timestamptz not null,attempts int not null default 1,primary key(user_id,bucket));
alter table public.premium_access_codes enable row level security;
alter table public.premium_access_grants enable row level security;
alter table public.access_code_attempts enable row level security;
revoke all on public.premium_access_codes,public.premium_access_grants,public.access_code_attempts from public,anon,authenticated;
grant all on public.premium_access_codes,public.premium_access_grants,public.access_code_attempts to service_role;

-- Current caller only, with no user ID parameter and no exposure of code records.
create or replace function public.has_active_membership() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (public.owner_has_app_access()
 or exists(select 1 from public.memberships where user_id=auth.uid() and expires_at>now())
 or exists(select 1 from public.premium_access_grants g join public.premium_access_codes c on c.id=g.code_id where g.user_id=auth.uid() and g.expires_at>now() and c.revoked_at is null));
$$;
revoke all on function public.has_active_membership() from public,anon;
grant execute on function public.has_active_membership() to authenticated;

create or replace function public.ensure_membership() returns public.memberships language plpgsql security definer set search_path='' as $$
declare result public.memberships;gift_until timestamptz;
begin
 if auth.uid() is null then raise exception 'Sign in first';end if;
 if public.owner_has_app_access() then
  result.user_id:=auth.uid();result.kind:='owner';result.expires_at:='9999-12-31T00:00:00Z'::timestamptz;result.created_at:=now();return result;
 end if;
 insert into public.memberships(user_id,kind,expires_at) values(auth.uid(),'trial',now()+interval '7 days') on conflict(user_id) do nothing;
 select * into result from public.memberships where user_id=auth.uid();
 select max(g.expires_at) into gift_until from public.premium_access_grants g join public.premium_access_codes c on c.id=g.code_id where g.user_id=auth.uid() and c.revoked_at is null;
 if gift_until>now() and gift_until>=result.expires_at then result.kind:='invite';result.expires_at:=gift_until;
 elsif result.expires_at<=now() then result.kind:='free';end if;
 return result;
end $$;
revoke all on function public.ensure_membership() from public,anon;
grant execute on function public.ensure_membership() to authenticated;

create function public.manage_premium_code(p_actor uuid,p_action text,p_id uuid default null,p_hash text default null,p_hint text default null,p_label text default null,p_days int default 30,p_uses int default 1,p_valid_days int default 30,p_email text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare created_id uuid;
begin
 if not exists(select 1 from public.owner_dashboard_access where user_id=p_actor and enabled) then raise exception 'Owner access required' using errcode='42501';end if;
 if p_action='create' then
  if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or length(coalesce(p_hint,''))<>4 or length(trim(coalesce(p_label,''))) not between 1 and 80 or p_days not between 1 and 365 or p_uses not between 1 and 100 or p_valid_days not between 1 and 90 or p_days is null or p_uses is null or p_valid_days is null then raise exception 'Check the access-code settings';end if;
  if p_email is not null and (length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') then raise exception 'Check the recipient email';end if;
  insert into public.premium_access_codes(code_hash,hint,label,days,max_uses,expires_at,bound_email,created_by)
  values(p_hash,p_hint,trim(p_label),p_days,p_uses,now()+make_interval(days=>p_valid_days),nullif(lower(trim(p_email)),''),p_actor) returning id into created_id;
 elsif p_action='revoke' then
  update public.premium_access_codes set revoked_at=coalesce(revoked_at,now()) where id=p_id;
  if not found then raise exception 'Access code not found';end if;
 elsif p_action<>'list' then raise exception 'Invalid code action';end if;
 return jsonb_build_object('created_id',created_id,'codes',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from(select c.id,c.hint,c.label,c.days,c.max_uses,c.uses,c.bound_email,c.expires_at,c.revoked_at,c.created_at,(select count(*) from public.premium_access_grants g where g.code_id=c.id and g.expires_at>now() and c.revoked_at is null) as active_grants from public.premium_access_codes c order by c.created_at desc limit 100)r),'[]'::jsonb));
end $$;
revoke all on function public.manage_premium_code(uuid,text,uuid,text,text,text,int,int,int,text) from public,anon,authenticated;
grant execute on function public.manage_premium_code(uuid,text,uuid,text,text,text,int,int,int,text) to service_role;

create function public.redeem_premium_code(p_user uuid,p_hash text,p_email text default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare code public.premium_access_codes;existing public.premium_access_grants;attempt_count int;until_at timestamptz;
begin
 if p_user is null or not exists(select 1 from public.users where id=p_user) then return jsonb_build_object('ok',false,'error','Sign in first.');end if;
 delete from public.access_code_attempts where user_id=p_user and bucket<now()-interval '7 days';
 insert into public.access_code_attempts(user_id,bucket) values(p_user,date_trunc('hour',now())) on conflict(user_id,bucket) do update set attempts=least(1000,public.access_code_attempts.attempts+1) returning attempts into attempt_count;
 if attempt_count>10 then return jsonb_build_object('ok',false,'error','Too many attempts. Try again in an hour.');end if;
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then return jsonb_build_object('ok',false,'error','This access code is unavailable. Check the code or ask the owner.');end if;
 select * into code from public.premium_access_codes where code_hash=p_hash for update;
 if not found or code.revoked_at is not null then return jsonb_build_object('ok',false,'error','This access code is unavailable. Check the code or ask the owner.');end if;
 if code.bound_email is not null and coalesce(lower(p_email),'')<>code.bound_email then return jsonb_build_object('ok',false,'error','This code is for a different account email.');end if;
 select * into existing from public.premium_access_grants where user_id=p_user and code_id=code.id;
 if found then return jsonb_build_object('ok',true,'already_redeemed',true,'expires_at',existing.expires_at);end if;
 if code.expires_at<=now() or code.uses>=code.max_uses then return jsonb_build_object('ok',false,'error','This access code has expired or reached its usage limit.');end if;
 -- Serialize different codes redeemed on the same account as well as shared codes.
 perform pg_advisory_xact_lock(hashtextextended('premium-invite:'||p_user::text,0));
 select greatest(now(),coalesce((select expires_at from public.memberships where user_id=p_user),now()),coalesce((select max(g.expires_at) from public.premium_access_grants g join public.premium_access_codes c on c.id=g.code_id where g.user_id=p_user and c.revoked_at is null),now()))+make_interval(days=>code.days) into until_at;
 insert into public.premium_access_grants(user_id,code_id,expires_at) values(p_user,code.id,until_at);
 update public.premium_access_codes set uses=uses+1 where id=code.id;
 return jsonb_build_object('ok',true,'expires_at',until_at);
end $$;
revoke all on function public.redeem_premium_code(uuid,text,text) from public,anon,authenticated;
grant execute on function public.redeem_premium_code(uuid,text,text) to service_role;

-- Free core logging retains all existing per-user ownership policies.
-- Programme creation/editing remains premium through its existing restrictive policies.
do $$ declare t text;begin
 foreach t in array array['workout_logs','logged_sets','calorie_transactions','calorie_bank'] loop
  execute format('alter policy membership_write_insert on public.%I with check ((select auth.uid()) is not null)',t);
  execute format('alter policy membership_write_update on public.%I using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null)',t);
 end loop;
end $$;
create function public.enforce_premium_session_start() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if current_user='authenticated' and new.day_id is not null and (tg_op='INSERT' or new.day_id is distinct from old.day_id) and not public.has_active_membership() then raise exception 'Premium is required to start a programme workout' using errcode='42501';end if;
 return new;
end $$;
revoke all on function public.enforce_premium_session_start() from public,anon,authenticated;
create trigger premium_programme_session before insert or update of day_id on public.workout_logs for each row execute function public.enforce_premium_session_start();


CREATE OR REPLACE FUNCTION public.confirm_yoco_payment(p_checkout text, p_payment text, p_mode text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare payment public.membership_payments;
begin
 select * into payment from public.membership_payments where checkout_id=p_checkout for update;
 if not found then raise exception 'Unknown checkout'; end if;
 if payment.mode <> p_mode then raise exception 'Payment mode mismatch'; end if;
 if payment.paid_at is not null then return; end if;
 -- Test payments exercise the pipeline without granting production paid access.
 update public.membership_payments set payment_id=p_payment, paid_at=now() where checkout_id=p_checkout;
 if p_mode='live' then
   perform pg_advisory_xact_lock(hashtextextended('premium-invite:'||payment.user_id::text,0));
   insert into public.memberships(user_id,kind,expires_at)
   values(payment.user_id,'paid',greatest(now(),coalesce((select max(g.expires_at) from public.premium_access_grants g join public.premium_access_codes c on c.id=g.code_id where g.user_id=payment.user_id and c.revoked_at is null),now()))+interval '30 days')
   on conflict(user_id) do update set kind='paid',
     expires_at=greatest(public.memberships.expires_at,now(),coalesce((select max(g.expires_at) from public.premium_access_grants g join public.premium_access_codes c on c.id=g.code_id where g.user_id=payment.user_id and c.revoked_at is null),now()))+interval '30 days';
 end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.log_nutrition_food(p_id uuid, p_day date, p_slot text, p_name text, p_items jsonb DEFAULT NULL::jsonb, p_kcal integer DEFAULT NULL::integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare total numeric:=0; i jsonb; f jsonb; grams numeric; snap jsonb:=null; uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Sign in first'; end if;
 if p_id is null or p_day is null or p_slot is null or p_name is null or p_day>current_date+1 or p_day<current_date-366 or p_slot not in ('breakfast','lunch','snack','dinner') or length(trim(p_name)) not between 1 and 100 then raise exception 'Check the food details'; end if;
 if p_items is not null then
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 30 then raise exception 'Invalid meal ingredients'; end if;
  for i in select value from jsonb_array_elements(p_items) loop
   select data into f from public.nutrition_foods where id=i->>'food_id';
   grams:=(i->>'grams')::numeric;
   if f is null or grams is null or grams::text in ('NaN','Infinity','-Infinity') or grams<1 or grams>1500 then raise exception 'Invalid food or grams'; end if;
   total:=total+(f->>'kcal')::numeric*grams/100;
  end loop;
  snap:=jsonb_build_object('items',p_items);
 else
  if p_kcal is null or p_kcal<1 or p_kcal>10000 then raise exception 'Enter 1–10,000 calories'; end if;
  total:=p_kcal;
 end if;
 if total<1 or total>10000 then raise exception 'Meal is outside supported calorie range'; end if;
 insert into public.calorie_transactions(id,user_id,occurred_at,kind,kcal,label,log_day,meal_slot,meal_snapshot)
 values(p_id,uid,(p_day::text||'T12:00:00Z')::timestamptz,'food',-round(total)::int,trim(p_name),p_day,p_slot,snap)
 on conflict(id) do update set kcal=excluded.kcal,label=excluded.label,log_day=excluded.log_day,
 occurred_at=excluded.occurred_at,meal_slot=excluded.meal_slot,meal_snapshot=excluded.meal_snapshot
 where calorie_transactions.user_id=uid and calorie_transactions.kind='food';
 if not found then raise exception 'Food record unavailable'; end if;
 -- Any correction makes previous "complete" acknowledgement stale.
 delete from public.nutrition_day_status where user_id=uid and day=p_day;
 return p_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.open_workout(p_day uuid DEFAULT NULL::uuid)
 RETURNS workout_logs
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare result public.workout_logs;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||coalesce(p_day::text,'free'),0));
 if p_day is not null and not exists(select 1 from public.programme_days where id=p_day and client_id=auth.uid()) then raise exception 'Workout not found'; end if;
 select * into result from public.workout_logs where client_id=auth.uid() and completed_at is null and cancelled_at is null
 and ((p_day is null and note='freeform') or day_id=p_day) order by created_at desc limit 1;
 if not found then
 if p_day is not null and not public.has_active_membership() then raise exception 'Premium is required to start a programme workout';end if;
 insert into public.workout_logs(client_id,day_id,note)
 values(auth.uid(),p_day,case when p_day is null then 'freeform' else null end) returning * into result;
 end if;
 return result;
end $function$
;

CREATE OR REPLACE FUNCTION public.sync_log_entry(p_id uuid, p_kind text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare uid uuid:=auth.uid(); prior public.log_sync_receipts; w public.workout_logs; s public.logged_sets; result jsonb; key text; ex uuid; pe uuid;
begin
 if uid is null then raise exception 'Sign in to sync'; end if;
 if p_id is null or p_kind is null or p_payload is null or p_kind not in ('food','set') or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>16000 then raise exception 'Invalid queued entry'; end if;
 -- Serialize a mutation across tabs/devices without relying on client-side locks.
 perform pg_advisory_xact_lock(hashtextextended(uid::text||p_id::text,0));
 select * into prior from public.log_sync_receipts where user_id=uid and mutation_id=p_id;
 if found then
  if prior.kind<>p_kind or prior.payload<>p_payload then raise exception 'CONFLICT: This entry was already synced with different details'; end if;
  if p_kind='food' then select to_jsonb(t) into result from public.calorie_transactions t where t.id=p_id and t.user_id=uid;
  else select to_jsonb(t) into result from public.logged_sets t where t.id=p_id and t.client_id=uid; end if;
  return jsonb_build_object('status',case when result is null then 'removed' else 'synced' end,'record',result);
 end if;

 if p_kind='food' then
  if exists(select 1 from public.calorie_transactions where id=p_id) then raise exception 'CONFLICT: A food entry already uses this ID'; end if;
  perform public.log_nutrition_food(p_id,(p_payload->>'day')::date,p_payload->>'slot',p_payload->>'name',nullif(p_payload->'items','null'::jsonb),(p_payload->>'kcal')::integer);
  select to_jsonb(t) into result from public.calorie_transactions t where t.id=p_id and t.user_id=uid;
 else
  select * into w from public.workout_logs where id=(p_payload->>'log_id')::uuid and client_id=uid for update;
  if not found or w.completed_at is not null or w.cancelled_at is not null then raise exception 'CONFLICT: Workout is finished, cancelled or unavailable'; end if;
  ex:=(p_payload->>'exercise_id')::uuid; pe:=(p_payload->>'programme_exercise_id')::uuid;
  key:=case when pe is not null then 'pe_'||pe::text else 'nm_'||(p_payload->>'exercise_name') end;
  if key=any(coalesce(w.excluded_exercises,'{}')) then raise exception 'CONFLICT: Exercise was removed from this session'; end if;
  if pe is not null and not exists(select 1 from public.programme_exercises where id=pe and client_id=uid and day_id=w.day_id) then raise exception 'Invalid programme exercise'; end if;
  if jsonb_typeof(w.session_plan)='array' and exists(select 1 from jsonb_array_elements(w.session_plan) item where item->>'key'=key and (item->>'exerciseId' is distinct from p_payload->>'exercise_id' or item->>'name' is distinct from p_payload->>'exercise_name')) then raise exception 'CONFLICT: This exercise was replaced on another device'; end if;
  if ex is not null and not exists(select 1 from public.exercises where id=ex and (owner_user_id is null or owner_user_id=uid)) then raise exception 'Invalid exercise'; end if;
  if p_payload->>'exercise_name' is null or p_payload->>'set_number' is null or p_payload->>'reps' is null or length(trim(p_payload->>'exercise_name')) not between 1 and 100 or (p_payload->>'set_number')::int not between 1 and 1000 or (p_payload->>'reps')::int not between 1 and 1000 or coalesce((p_payload->>'weight')::numeric,0) not between 0 and 9999.99 then raise exception 'Invalid set values'; end if;
  if p_payload->>'reps_left' is not null and ((p_payload->>'reps_left')::int not between 1 and 1000 or coalesce((p_payload->>'weight_left')::numeric,0) not between 0 and 9999.99) then raise exception 'Invalid paired set'; end if;
  if exists(select 1 from public.logged_sets where id=p_id or (log_id=w.id and client_id=uid and programme_exercise_id is not distinct from pe and exercise_name=p_payload->>'exercise_name' and set_number=(p_payload->>'set_number')::int)) then raise exception 'CONFLICT: This session set already exists; review the saved set'; end if;
  insert into public.logged_sets(id,client_id,log_id,exercise_name,exercise_id,programme_exercise_id,set_number,set_type,rir,weight,reps,weight_left,reps_left,target_rep_min,target_rep_max,target_rir,completed)
  values(p_id,uid,w.id,trim(p_payload->>'exercise_name'),ex,pe,(p_payload->>'set_number')::int,'normal',(p_payload->>'rir')::int,(p_payload->>'weight')::numeric,(p_payload->>'reps')::int,(p_payload->>'weight_left')::numeric,(p_payload->>'reps_left')::int,(p_payload->>'target_rep_min')::int,(p_payload->>'target_rep_max')::int,(p_payload->>'target_rir')::int,true) returning * into s;
  result:=to_jsonb(s);
 end if;
 insert into public.log_sync_receipts(user_id,mutation_id,kind,payload) values(uid,p_id,p_kind,p_payload);
 return jsonb_build_object('status','synced','record',result);
end $function$
;

-- Report only existing GymIQ profile data; no additional permissions on Auth records.
create or replace function public.owner_dashboard_report(p_actor uuid,p_search text default '',p_page int default 0,p_status text default 'all',p_include_test boolean default false)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare answer jsonb;today date:=(now() at time zone 'Africa/Johannesburg')::date;
begin
 if p_actor is null or not exists(select 1 from public.owner_dashboard_access where user_id=p_actor and enabled) then raise exception 'Owner access required' using errcode='42501';end if;
 if p_status not in ('all','paid','trial','invite','expired','none') or p_status is null then raise exception 'Invalid membership filter';end if;
 with people as materialized(
  select u.id,u.name,u.email,u.created_at,
   coalesce(r.source,'unknown') as source,
   exists(select 1 from public.owner_reporting_exclusions x where x.user_id=u.id)
    or exists(select 1 from public.owner_dashboard_access x where x.user_id=u.id)
    or exists(select 1 from public.workout_logs w where w.client_id=u.id and w.note like 'GYMIQ_MOCK_%') as excluded,
   greatest(m.expires_at,g.expires_at) as expires_at,
   case when g.expires_at>now() and g.expires_at>=coalesce(m.expires_at,now()) then 'invite' when m.expires_at<=now() then 'expired' when m.kind='paid' and exists(select 1 from public.membership_payments p where p.user_id=u.id and p.mode='live' and p.paid_at<=now() and p.payment_id is not null) then 'paid' when m.kind='trial' then 'trial' else 'none' end as membership
  from public.users u left join public.memberships m on m.user_id=u.id left join lateral(select max(g.expires_at) as expires_at from public.premium_access_grants g join public.premium_access_codes c on c.id=g.code_id where g.user_id=u.id and c.revoked_at is null and g.expires_at>now())g on true left join public.signup_referrals r on r.user_id=u.id
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
   'paying_members',count(*) filter(where membership='paid'),'invite_members',(select count(*) from people where not excluded and membership='invite'),'trial_members',count(*) filter(where membership='trial'),'expired_members',count(*) filter(where membership='expired'),
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
