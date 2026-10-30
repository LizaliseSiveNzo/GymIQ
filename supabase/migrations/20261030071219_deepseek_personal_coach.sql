-- The personal coach is opt-in and enabled for a server-managed account allowlist.
create table public.personal_coach_access (
 user_id uuid primary key references public.users(id) on delete cascade,
 enabled boolean not null default true
);
alter table public.personal_coach_access enable row level security;
revoke all on public.personal_coach_access from public,anon,authenticated;
grant select on public.personal_coach_access to authenticated;
grant all on public.personal_coach_access to service_role;
create policy own_coach_access on public.personal_coach_access for select to authenticated using ((select auth.uid())=user_id);

create table public.coach_settings (
 user_id uuid primary key references public.users(id) on delete cascade,
 pantry text[] not null default '{}', equipment text[] not null default '{}',
 updated_at timestamptz not null default now(),
 check(cardinality(pantry)<=100 and cardinality(equipment)<=100)
);
alter table public.coach_settings enable row level security;
revoke all on public.coach_settings from public,anon,authenticated;
grant select,insert,update on public.coach_settings to authenticated;
grant all on public.coach_settings to service_role;
create policy own_coach_settings_read on public.coach_settings for select to authenticated using ((select auth.uid())=user_id);
create policy own_coach_settings_insert on public.coach_settings for insert to authenticated with check ((select auth.uid())=user_id and exists(select 1 from public.personal_coach_access a where a.user_id=(select auth.uid()) and a.enabled));
create policy own_coach_settings_update on public.coach_settings for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id and exists(select 1 from public.personal_coach_access a where a.user_id=(select auth.uid()) and a.enabled));

create table public.coach_turns (
 id uuid primary key, user_id uuid not null references public.users(id) on delete cascade,
 prompt text not null check(length(prompt) between 1 and 2000),
 reply text, status text not null default 'pending' check(status in ('pending','done','error')),
 total_tokens integer not null default 0 check(total_tokens>=0),
 created_at timestamptz not null default now(), consent_version text not null default 'deepseek-personal-v1'
);
create index coach_turns_owner_time on public.coach_turns(user_id,created_at desc);
alter table public.coach_turns enable row level security;
revoke all on public.coach_turns from public,anon,authenticated;
grant select on public.coach_turns to authenticated;
grant all on public.coach_turns to service_role;
create policy own_coach_turns on public.coach_turns for select to authenticated using ((select auth.uid())=user_id);

create table public.coach_actions (
 id uuid primary key, user_id uuid not null references public.users(id) on delete cascade,
 turn_id uuid not null references public.coach_turns(id) on delete cascade,
 kind text not null check(kind in ('meal','meal_plan','workout')),
 payload jsonb not null, baseline jsonb not null,
 status text not null default 'draft' check(status in ('draft','applied','discarded')),
 created_at timestamptz not null default now(), applied_at timestamptz,
 expires_at timestamptz not null default (now()+interval '24 hours')
);
create index coach_actions_owner_time on public.coach_actions(user_id,created_at desc);
alter table public.coach_actions enable row level security;
revoke all on public.coach_actions from public,anon,authenticated;
grant select on public.coach_actions to authenticated;
grant all on public.coach_actions to service_role;
create policy own_coach_actions on public.coach_actions for select to authenticated using ((select auth.uid())=user_id);

create function public.reserve_coach_turn(p_user uuid,p_id uuid,p_prompt text) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('personal-coach',0));
 if not exists(select 1 from public.personal_coach_access where user_id=p_user and enabled) then raise exception 'Personal coach is not enabled for this account'; end if;
 if exists(select 1 from public.coach_turns where id=p_id and user_id=p_user) then return jsonb_build_object('status','duplicate'); end if;
 if exists(select 1 from public.coach_turns where user_id=p_user and status='pending' and created_at>now()-interval '3 minutes') then raise exception 'A response is already being prepared. Please wait.'; end if;
 if (select count(*) from public.coach_turns where user_id=p_user and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=50
 or (select count(*) from public.coach_turns where created_at>now()-interval '1 minute')>=6 then raise exception 'Coach request allowance reached. Try again later.'; end if;
 insert into public.coach_turns(id,user_id,prompt) values(p_id,p_user,p_prompt);
 return jsonb_build_object('status','reserved');
end $$;
revoke all on function public.reserve_coach_turn(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_coach_turn(uuid,uuid,text) to service_role;

create function public.finish_coach_turn(p_user uuid,p_id uuid,p_reply text,p_tokens int,p_actions jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare a jsonb;
begin
 perform 1 from public.coach_turns where id=p_id and user_id=p_user and status='pending' for update;
 if not found then raise exception 'Response already completed'; end if;
 if length(p_reply)>6000 or jsonb_array_length(p_actions)>3 then raise exception 'Invalid coach response'; end if;
 for a in select * from jsonb_array_elements(p_actions) loop
 insert into public.coach_actions(id,user_id,turn_id,kind,payload,baseline) values((a->>'id')::uuid,p_user,p_id,a->>'kind',a->'payload',a->'baseline');
 end loop;
 update public.coach_turns set reply=p_reply,total_tokens=p_tokens,status='done' where id=p_id and user_id=p_user;
end $$;
revoke all on function public.finish_coach_turn(uuid,uuid,text,int,jsonb) from public,anon,authenticated;
grant execute on function public.finish_coach_turn(uuid,uuid,text,int,jsonb) to service_role;

-- Only server-validated immutable drafts may cross into existing planning tables.
create function public.apply_coach_action(p_id uuid,p_discard boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); a public.coach_actions; current_goal timestamptz; current_plan timestamptz; current_program uuid; settings jsonb; pid uuid;
begin
 if uid is null or not exists(select 1 from public.personal_coach_access where user_id=uid and enabled) then raise exception 'Personal coach is not enabled'; end if;
 if not public.has_active_membership() then raise exception 'Active membership is required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select * into a from public.coach_actions where id=p_id and user_id=uid for update;
 if not found then raise exception 'Proposal not found'; end if;
 if a.status='applied' then return jsonb_build_object('status','applied','id',a.id); end if;
 if a.status<>'draft' then raise exception 'This proposal was discarded'; end if;
 if p_discard then update public.coach_actions set status='discarded' where id=a.id; return jsonb_build_object('status','discarded'); end if;
 if a.expires_at<now() then raise exception 'This proposal expired. Ask the coach for a fresh one.'; end if;
 select jsonb_build_object('pantry',pantry,'equipment',equipment) into settings from public.coach_settings where user_id=uid for share;
 if settings is distinct from a.baseline->'settings' then raise exception 'Your ingredients or equipment changed. Request a new proposal.'; end if;
 select updated_at into current_goal from public.nutrition_goals where user_id=uid for share;
 if current_goal is distinct from (a.baseline->>'goal_updated_at')::timestamptz then raise exception 'Your goals changed. Request a new proposal.'; end if;
 if a.kind='meal' then
 insert into public.saved_meals(id,user_id,name,slot,items) values(a.id,uid,a.payload->>'name',a.payload->>'slot',a.payload->'items');
 elsif a.kind='meal_plan' then
 if (a.payload->>'day')::date<>(now()+make_interval(mins=>-(a.baseline->>'offset')::int))::date then raise exception 'This daily plan is from another day. Request a new plan.'; end if;
 select created_at into current_plan from public.nutrition_meal_plans where user_id=uid and day=(a.payload->>'day')::date for update;
 if current_plan is distinct from (a.baseline->>'plan_created_at')::timestamptz then raise exception 'Your meal plan changed. Request a new proposal.'; end if;
 insert into public.nutrition_meal_plans(user_id,day,plan,target,source,created_at) values(uid,(a.payload->>'day')::date,a.payload->'meals',(a.payload->>'target')::int,'deepseek',now())
 on conflict(user_id,day) do update set plan=excluded.plan,target=excluded.target,source=excluded.source,created_at=excluded.created_at;
 else
 select id into current_program from public.workout_programmes where client_id=uid and is_active order by created_at desc limit 1;
 if current_program is distinct from (a.baseline->>'programme_id')::uuid then raise exception 'Your training programme changed. Request a new proposal.'; end if;
 if exists(select 1 from public.workout_logs where client_id=uid and completed_at is null and cancelled_at is null) then raise exception 'Finish or cancel your current session before changing programmes.'; end if;
 pid:=public.save_generated_program(a.payload->'generated',jsonb_build_object('name',a.payload->>'name'),a.id);
 end if;
 update public.coach_actions set status='applied',applied_at=now() where id=a.id;
 return jsonb_build_object('status','applied','id',a.id);
end $$;
revoke all on function public.apply_coach_action(uuid,boolean) from public,anon;
grant execute on function public.apply_coach_action(uuid,boolean) to authenticated;

alter table public.nutrition_meal_plans drop constraint nutrition_meal_plans_source_check;
alter table public.nutrition_meal_plans add constraint nutrition_meal_plans_source_check check(source in ('rules','groq','deepseek'));
-- Email was explicitly confirmed by the owner. No account is created if it does not exist.
insert into public.personal_coach_access(user_id)
 select u.id from auth.users u join public.users p on p.id=u.id where lower(u.email)='lizalisenzo@gmail.com'
 on conflict(user_id) do update set enabled=true;
