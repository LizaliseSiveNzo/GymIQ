-- Opt-in AI reviews cache commentary only; calorie totals and PRs remain computed.
create table public.ai_review_cache (
 user_id uuid not null references public.users(id) on delete cascade,
 review_domain text not null check(review_domain in ('training','nutrition')),
 snapshot_hash text not null check(snapshot_hash ~ '^[0-9a-f]{64}$'),
 review jsonb not null,
 model text not null,
 consented_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 primary key(user_id,review_domain,snapshot_hash)
);
create table public.ai_review_attempts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.users(id) on delete cascade,
 review_domain text not null check(review_domain in ('training','nutrition')),
 snapshot_hash text not null,
 created_at timestamptz not null default now(),
 total_tokens integer check(total_tokens>=0)
);
create index idx_ai_attempts_recent on public.ai_review_attempts(created_at desc);
create index idx_ai_attempts_owner on public.ai_review_attempts(user_id,review_domain,created_at desc);
alter table public.ai_review_cache enable row level security;
alter table public.ai_review_attempts enable row level security;
revoke all on public.ai_review_cache,public.ai_review_attempts from anon,authenticated;
grant select,delete on public.ai_review_cache to authenticated;
grant select on public.ai_review_attempts to authenticated;
grant all on public.ai_review_cache,public.ai_review_attempts to service_role;
create policy ai_cache_owner_read on public.ai_review_cache for select to authenticated using(user_id=(select auth.uid()));
create policy ai_cache_owner_delete on public.ai_review_cache for delete to authenticated using(user_id=(select auth.uid()));
create policy ai_attempts_owner_read on public.ai_review_attempts for select to authenticated using(user_id=(select auth.uid()));

-- Only the authenticated Edge Function can reserve provider calls. All attempts count,
-- including timeouts: retries cannot silently exceed the app's free-tier budget.
create function public.reserve_ai_review(p_user uuid,p_domain text,p_hash text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare attempt_id uuid; since_day timestamptz:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
begin
 if p_domain not in ('training','nutrition') or p_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid review'; end if;
 perform pg_advisory_xact_lock(hashtextextended('gymiq:groq:budget',0));
 if (select count(*) from public.ai_review_attempts where user_id=p_user and review_domain=p_domain and created_at>=since_day)>=2 then return jsonb_build_object('status','user_limit'); end if;
 if exists(select 1 from public.ai_review_attempts where user_id=p_user and review_domain=p_domain and snapshot_hash=p_hash and created_at>now()-interval '1 minute') then return jsonb_build_object('status','busy'); end if;
 if (select count(*) from public.ai_review_attempts where created_at>=since_day)>=50 then return jsonb_build_object('status','app_limit'); end if;
 if (select count(*) from public.ai_review_attempts where created_at>now()-interval '1 minute')>=2 then return jsonb_build_object('status','busy'); end if;
 insert into public.ai_review_attempts(user_id,review_domain,snapshot_hash) values(p_user,p_domain,p_hash) returning id into attempt_id;
 return jsonb_build_object('status','reserved','id',attempt_id);
end $$;
revoke all on function public.reserve_ai_review(uuid,text,text) from public,anon,authenticated;
grant execute on function public.reserve_ai_review(uuid,text,text) to service_role;

create function public.gymiq_review_snapshot(p_domain text,p_day date,p_offset integer default 0)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare start_at timestamptz; result jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if p_day is null or abs(p_day-current_date)>2 or p_offset is null or abs(p_offset)>840 then raise exception 'Invalid review day'; end if;
 start_at:=(p_day::timestamp at time zone 'UTC')+make_interval(mins=>p_offset);
 if p_domain='training' then
 with eligible as (
  select s.*,w.completed_at,
   coalesce(s.exercise_id::text,'name:'||lower(btrim(s.exercise_name))) as exercise_key
  from public.logged_sets s join public.workout_logs w on w.id=s.log_id
  where s.client_id=auth.uid() and w.client_id=auth.uid() and w.completed_at is not null and w.cancelled_at is null
  and w.completed_at>=start_at-interval '89 days' and w.completed_at<start_at+interval '1 day'
  and s.completed is true and s.set_type<>'warmup' and (coalesce(s.reps,0)>0 or coalesce(s.reps_left,0)>0)
  and not ((case when s.programme_exercise_id is not null then 'pe_'||s.programme_exercise_id::text else 'nm_'||s.exercise_name end)=any(w.excluded_exercises))
 ), per_session as (
  select exercise_key,exercise_name,log_id,completed_at,count(*) as working_sets,
   sum(coalesce(weight,0)*coalesce(reps,0)+coalesce(weight_left,0)*coalesce(reps_left,0)) as volume
  from eligible group by exercise_key,exercise_name,log_id,completed_at
 ), candidates as (
  select e.exercise_key,e.log_id,c.weight,c.reps,row_number() over(partition by e.exercise_key,e.log_id order by c.weight desc,c.reps desc,e.created_at desc,e.id) as position
  from eligible e cross join lateral (values(coalesce(e.weight,0),coalesce(e.reps,0)),(coalesce(e.weight_left,0),coalesce(e.reps_left,0))) c(weight,reps) where c.reps>0
 ), ranked as (
  select s.*,c.weight,c.reps,row_number() over(partition by s.exercise_key order by s.completed_at desc,s.log_id) as position
  from per_session s join candidates c on c.exercise_key=s.exercise_key and c.log_id=s.log_id and c.position=1
 ), exercises as (
  select exercise_key,max(exercise_name) as name,max(completed_at) as latest_at,
    max(weight) filter(where position=1) as last_weight,max(reps) filter(where position=1) as last_reps,
    max(weight) filter(where position=2) as previous_weight,max(reps) filter(where position=2) as previous_reps,
    max(working_sets) filter(where position=1) as last_sets
  from ranked where position<=2 group by exercise_key order by latest_at desc,exercise_key limit 6
 ) select jsonb_build_object('domain','training','day',p_day,'range_days',90,
  'sessions_recent7',(select count(distinct log_id) from eligible where completed_at>=start_at-interval '6 days'),
  'sessions_previous7',(select count(distinct log_id) from eligible where completed_at>=start_at-interval '13 days' and completed_at<start_at-interval '6 days'),
  'working_sets_recent7',(select count(*) from eligible where completed_at>=start_at-interval '6 days'),
  'exercises',coalesce((select jsonb_agg(to_jsonb(exercises)) from exercises),'[]'::jsonb)) into result;
 elsif p_domain='nutrition' then
  select jsonb_build_object('domain','nutrition','day',p_day,
   'daily_target',coalesce((select daily_target from public.calorie_bank where user_id=auth.uid()),0),
   'food_kcal_today',coalesce(sum(abs(kcal)) filter(where kind='food' and occurred_at>=start_at),0),
   'food_entries_today',count(*) filter(where kind='food' and occurred_at>=start_at),
   'food_days_recent7',count(distinct ((occurred_at at time zone 'UTC')-make_interval(mins=>p_offset))::date) filter(where kind='food'),
   'food_kcal_recent7',coalesce(sum(abs(kcal)) filter(where kind='food'),0),
   'activity_kcal_today',coalesce(sum(greatest(kcal,0)) filter(where kind='exercise' and occurred_at>=start_at),0)
  ) into result from public.calorie_transactions
   where user_id=auth.uid() and occurred_at>=start_at-interval '6 days' and occurred_at<start_at+interval '1 day';
 else raise exception 'Invalid review type'; end if;
 return result;
end $$;
revoke all on function public.gymiq_review_snapshot(text,date,integer) from public,anon;
grant execute on function public.gymiq_review_snapshot(text,date,integer) to authenticated;
