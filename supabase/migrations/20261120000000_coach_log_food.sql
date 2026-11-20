-- Add a "log_food" coach action: the AI coach can log a meal the user has eaten
-- directly to the food diary (via log_nutrition_food). Logging does not depend on
-- the saved goal, so the goal-change guard only applies to meal/plan/workout drafts.
create or replace function public.apply_coach_action(p_id uuid,p_discard boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); a public.coach_actions; current_goal timestamptz; current_plan timestamptz; current_program uuid; pid uuid;
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
 if a.kind='log_food' then
  perform public.log_nutrition_food(a.id,(a.payload->>'day')::date,a.payload->>'slot',a.payload->>'name',a.payload->'items',null);
 elsif a.kind='meal' then
  select updated_at into current_goal from public.nutrition_goals where user_id=uid for share;
  if current_goal is distinct from (a.baseline->>'goal_updated_at')::timestamptz then raise exception 'Your goals changed. Request a new proposal.'; end if;
  insert into public.saved_meals(id,user_id,name,slot,items) values(a.id,uid,a.payload->>'name',a.payload->>'slot',a.payload->'items');
 elsif a.kind='meal_plan' then
  select updated_at into current_goal from public.nutrition_goals where user_id=uid for share;
  if current_goal is distinct from (a.baseline->>'goal_updated_at')::timestamptz then raise exception 'Your goals changed. Request a new proposal.'; end if;
  if (a.payload->>'day')::date<>(now()+make_interval(mins=>-(a.baseline->>'offset')::int))::date then raise exception 'This daily plan is from another day. Request a new plan.'; end if;
  select created_at into current_plan from public.nutrition_meal_plans where user_id=uid and day=(a.payload->>'day')::date for update;
  if current_plan is distinct from (a.baseline->>'plan_created_at')::timestamptz then raise exception 'Your meal plan changed. Request a new proposal.'; end if;
  insert into public.nutrition_meal_plans(user_id,day,plan,target,source,created_at) values(uid,(a.payload->>'day')::date,a.payload->'meals',(a.payload->>'target')::int,'deepseek',now())
  on conflict(user_id,day) do update set plan=excluded.plan,target=excluded.target,source=excluded.source,created_at=excluded.created_at;
 else
  select updated_at into current_goal from public.nutrition_goals where user_id=uid for share;
  if current_goal is distinct from (a.baseline->>'goal_updated_at')::timestamptz then raise exception 'Your goals changed. Request a new proposal.'; end if;
  select id into current_program from public.workout_programmes where client_id=uid and is_active order by created_at desc limit 1;
  if current_program is distinct from (a.baseline->>'programme_id')::uuid then raise exception 'Your training programme changed. Request a new proposal.'; end if;
  if exists(select 1 from public.workout_logs where client_id=uid and completed_at is null and cancelled_at is null) then raise exception 'Finish or cancel your current session before changing programmes.'; end if;
  pid:=public.save_generated_program(a.payload->'generated',jsonb_build_object('name',a.payload->>'name'),a.id);
 end if;
 update public.coach_actions set status='applied',applied_at=now() where id=a.id;
 return jsonb_build_object('status','applied','id',a.id);
end $$;
revoke all on function public.apply_coach_action(uuid,boolean) from public,anon,authenticated;
grant execute on function public.apply_coach_action(uuid,boolean) to authenticated;
