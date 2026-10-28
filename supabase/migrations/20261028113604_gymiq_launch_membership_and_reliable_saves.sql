-- GymIQ launch: server-owned access, atomic programme creation/completion.
create table public.memberships (
 user_id uuid primary key references public.users(id) on delete cascade,
 kind text not null check (kind in ('trial','paid')),
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
alter table public.memberships enable row level security;
create policy membership_owner_read on public.memberships for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.memberships from anon, authenticated;
grant select on public.memberships to authenticated;
grant all on public.memberships to service_role;

create table public.membership_payments (
 checkout_id text primary key,
 user_id uuid not null references public.users(id) on delete cascade,
 amount int not null check (amount = 10000),
 currency text not null check (currency = 'ZAR'),
 mode text not null check (mode in ('test','live')),
 payment_id text unique,
 paid_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.membership_payments enable row level security;
create policy payment_owner_read on public.membership_payments for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.membership_payments from anon, authenticated;
grant select on public.membership_payments to authenticated;
grant all on public.membership_payments to service_role;
create index membership_payments_user on public.membership_payments(user_id);

create function public.ensure_membership() returns public.memberships
language plpgsql security definer set search_path = '' as $$
declare result public.memberships;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 insert into public.memberships(user_id, kind, expires_at)
 values(auth.uid(), 'trial', now() + interval '7 days') on conflict (user_id) do nothing;
 select * into result from public.memberships where user_id=auth.uid();
 return result;
end $$;
revoke all on function public.ensure_membership() from public, anon;
grant execute on function public.ensure_membership() to authenticated;

create function public.confirm_yoco_payment(p_checkout text, p_payment text, p_mode text)
returns void language plpgsql security definer set search_path = '' as $$
declare payment public.membership_payments;
begin
 select * into payment from public.membership_payments where checkout_id=p_checkout for update;
 if not found then raise exception 'Unknown checkout'; end if;
 if payment.mode <> p_mode then raise exception 'Payment mode mismatch'; end if;
 if payment.paid_at is not null then return; end if;
 -- Test payments exercise the pipeline without granting production paid access.
 update public.membership_payments set payment_id=p_payment, paid_at=now() where checkout_id=p_checkout;
 if p_mode='live' then
   insert into public.memberships(user_id,kind,expires_at)
   values(payment.user_id,'paid',now()+interval '30 days')
   on conflict(user_id) do update set kind='paid',
     expires_at=greatest(public.memberships.expires_at,now())+interval '30 days';
 end if;
end $$;
revoke all on function public.confirm_yoco_payment(text,text,text) from public, anon, authenticated;
grant execute on function public.confirm_yoco_payment(text,text,text) to service_role;

create function public.save_generated_program(p_generated jsonb, p_options jsonb, p_request_id uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare uid uuid := auth.uid(); pid uuid; did uuid; d jsonb; x jsonb; w jsonb;
begin
 if uid is null then raise exception 'Sign in first'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if exists(select 1 from public.workout_programmes where id=p_request_id and client_id=uid) then return p_request_id; end if;
 if jsonb_array_length(p_generated->'days') < 1 then raise exception 'Programme must contain workouts'; end if;
 if nullif(p_options->>'gymProfileId','') is not null and not exists(
  select 1 from public.gym_profiles where id=(p_options->>'gymProfileId')::uuid and user_id=uid
 ) then raise exception 'Invalid gym'; end if;
 update public.workout_programmes set is_active=false where client_id=uid and is_active;
 insert into public.workout_programmes(id,client_id,name,is_active,goal,split,days_per_week,session_minutes,
 deload_policy,color,icon,current_week,generated,source,gym_profile_id)
 values(p_request_id,uid,p_options->>'name',true,p_generated->>'goal',p_generated->>'split',
 (p_generated->>'daysPerWeek')::int,(p_generated->>'sessionMinutes')::int,p_generated->>'deloadPolicy',
 coalesce(p_options->>'color','#C6FF3A'),coalesce(p_options->>'icon','💪'),1,true,'generator',
 nullif(p_options->>'gymProfileId','')::uuid) returning id into pid;
 for w in select * from jsonb_array_elements(p_generated->'weeks') loop
 insert into public.programme_weeks(client_id,programme_id,week_number,kind,volume_multiplier)
 values(uid,pid,(w->>'weekNumber')::int,w->>'kind',(w->>'volumeMultiplier')::numeric);
 end loop;
 for d in select * from jsonb_array_elements(p_generated->'days') loop
 insert into public.programme_days(client_id,programme_id,name,label,sort_order)
 values(uid,pid,(d->>'label')||' · '||(d->>'name'),d->>'label',(d->>'dayIndex')::int) returning id into did;
 for x in select * from jsonb_array_elements(d->'exercises') loop
 insert into public.programme_exercises(client_id,day_id,exercise_id,name,target_sets,target_reps,target_rir,rest_seconds,movement_pattern,sort_order)
 values(uid,did,(x->>'exerciseId')::uuid,x->>'name',(x->>'sets')::int,
 (x->>'repMin')||'-'||(x->>'repMax'),(x->>'rir')::int,(x->>'restSeconds')::int,x->>'pattern',(x->>'sort')::int);
 end loop;
 end loop;
 return pid;
end $$;
revoke all on function public.save_generated_program(jsonb,jsonb,uuid) from public, anon;
grant execute on function public.save_generated_program(jsonb,jsonb,uuid) to authenticated;

create function public.finish_workout(p_log uuid, p_duration int, p_day date, p_prs jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare pr jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.workout_logs where id=p_log and client_id=auth.uid()) then raise exception 'Workout not found'; end if;
 update public.workout_logs set completed_at=coalesce(completed_at,now()),duration_sec=greatest(0,p_duration) where id=p_log and client_id=auth.uid();
 insert into public.habits(user_id,day,worked_out) values(auth.uid(),p_day,true)
 on conflict(user_id,day) do update set worked_out=true;
 for pr in select * from jsonb_array_elements(p_prs) loop
 insert into public.personal_records(user_id,exercise_name,pr_type,value,achieved_on)
 values(auth.uid(),pr->>'exerciseName',case when pr->>'type'='volume' then 'volume' else 'e1rm' end,(pr->>'value')::numeric,p_day)
 on conflict(user_id,exercise_name,pr_type) do update set value=greatest(public.personal_records.value,excluded.value),
 achieved_on=case when excluded.value>public.personal_records.value then excluded.achieved_on else public.personal_records.achieved_on end;
 end loop;
end $$;
revoke all on function public.finish_workout(uuid,int,date,jsonb) from public, anon;
grant execute on function public.finish_workout(uuid,int,date,jsonb) to authenticated;

-- Retire the old role-based users policies. Profile fields cannot promote roles.
drop policy if exists admin_all_users on public.users;
drop policy if exists coach_read_player_users on public.users;
revoke update on public.users from authenticated;
grant update(name,sex,dob,height_cm,body_fat_pct,training_experience,cardio_experience,
 units,theme,health_link_consent,onboarding_state,onboarded_at,disclaimer_version,disclaimer_accepted_at,
 consent_version,consent_accepted_at) on public.users to authenticated;
-- Client-writable legacy entitlements are not accepted as payment evidence.
revoke insert,update,delete on public.entitlements from authenticated;


create table public.support_requests(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.users(id) on delete cascade,
 subject text not null check(length(subject) between 3 and 160),
 message text not null check(length(message) between 10 and 5000),
 created_at timestamptz not null default now()
);
alter table public.support_requests enable row level security;
create policy support_owner_read on public.support_requests for select to authenticated using(user_id=(select auth.uid()));
create policy support_owner_insert on public.support_requests for insert to authenticated with check(user_id=(select auth.uid()));
revoke all on public.support_requests from anon, authenticated;
grant select,insert on public.support_requests to authenticated;
grant all on public.support_requests to service_role;

create function public.export_my_data() returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb := '{}'::jsonb; t record; rows jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 for t in
 select distinct c.table_name, case when c.table_name='users' then 'id' else c.column_name end as owner_column
 from information_schema.columns c join information_schema.tables b on b.table_name=c.table_name and b.table_schema=c.table_schema
 where c.table_schema='public' and b.table_type='BASE TABLE' and
 ((c.column_name in ('user_id','client_id','owner_user_id') and c.data_type='uuid') or(c.table_name='users' and c.column_name='id'))
 and has_table_privilege(current_user,format('public.%I',c.table_name),'SELECT')
 loop
 execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from public.%I r where %I=$1',t.table_name,t.owner_column)
 into rows using auth.uid();
 result := result || jsonb_build_object(t.table_name,rows);
 end loop;
 -- Equipment is owned via gym profile, rather than a direct user_id.
 select coalesce(jsonb_agg(to_jsonb(e)),'[]'::jsonb) into rows from public.gym_profile_equipment e
 where profile_id in (select id from public.gym_profiles where user_id=auth.uid());
 return result || jsonb_build_object('gym_profile_equipment',rows);
end $$;
revoke all on function public.export_my_data() from public,anon;
grant execute on function public.export_my_data() to authenticated;

create function public.has_active_membership() returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.memberships where user_id=(select auth.uid()) and expires_at>now());
$$;
revoke all on function public.has_active_membership() from public,anon;
grant execute on function public.has_active_membership() to authenticated;
do $$
declare t text;
begin
 foreach t in array array['workout_programmes','programme_weeks','programme_days','programme_exercises','workout_logs','logged_sets','calorie_bank','calorie_transactions']
 loop
 execute format('create policy membership_write_insert on public.%I as restrictive for insert to authenticated with check((select public.has_active_membership()))',t);
 execute format('create policy membership_write_update on public.%I as restrictive for update to authenticated using((select public.has_active_membership())) with check((select public.has_active_membership()))',t);
 end loop;
end $$;
