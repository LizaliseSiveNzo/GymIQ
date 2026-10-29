-- All calorie guide calculations run in the authenticated Edge Function, not the model.
create table public.nutrition_foods(id text primary key, data jsonb not null);
alter table public.nutrition_foods enable row level security;
create policy nutrition_foods_read on public.nutrition_foods for select to authenticated using (true);
grant select on public.nutrition_foods to authenticated;
insert into public.nutrition_foods values ('173904', '{"id": "173904", "name": "Oats \u00b7 dry", "kcal": 379.0, "protein": 13.15, "fat": 6.52, "carbs": 67.7, "allergens": ["gluten"], "vegetarian": true, "vegan": true, "source_description": "Cereals, oats, regular and quick, not fortified, dry", "source_url": "https://fdc.nal.usda.gov/food-details/173904/nutrients"}'::jsonb);
insert into public.nutrition_foods values ('171267', '{"id": "171267", "name": "Milk \u00b7 2%", "kcal": 50.0, "protein": 3.3, "fat": 1.98, "carbs": 4.8, "allergens": ["milk"], "vegetarian": true, "vegan": false, "source_description": "Milk, reduced fat, fluid, 2% milkfat, with added vitamin A and vitamin D", "source_url": "https://fdc.nal.usda.gov/food-details/171267/nutrients"}'::jsonb);
insert into public.nutrition_foods values ('170886', '{"id": "170886", "name": "Plain low-fat yoghurt", "kcal": 63.0, "protein": 5.25, "fat": 1.55, "carbs": 7.04, "allergens": ["milk"], "vegetarian": true, "vegan": false, "source_description": "Yogurt, plain, low fat", "source_url": "https://fdc.nal.usda.gov/food-details/170886/nutrients"}'::jsonb);
insert into public.nutrition_foods values ('173944', '{"id": "173944", "name": "Banana", "kcal": 89.0, "protein": 1.09, "fat": 0.33, "carbs": 22.84, "allergens": [], "vegetarian": true, "vegan": true, "source_description": "Bananas, raw", "source_url": "https://fdc.nal.usda.gov/food-details/173944/nutrients"}'::jsonb);
insert into public.nutrition_foods values ('171688', '{"id": "171688", "name": "Apple \u00b7 with skin", "kcal": 52.0, "protein": 0.26, "fat": 0.17, "carbs": 13.81, "allergens": [], "vegetarian": true, "vegan": true, "source_description": "Apples, raw, with skin (Includes foods for USDA''s Food Distribution Program)", "source_url": "https://fdc.nal.usda.gov/food-details/171688/nutrients"}'::jsonb);
insert into public.nutrition_foods values ('173424', '{"id": "173424", "name": "Egg \u00b7 hard-boiled", "kcal": 155.0, "protein": 12.58, "fat": 10.61, "carbs": 1.12, "allergens": ["egg"], "vegetarian": true, "vegan": false, "source_description": "Egg, whole, cooked, hard-boiled", "source_url": "https://fdc.nal.usda.gov/food-details/173424/nutrients"}'::jsonb);
insert into public.nutrition_foods values ('172688', '{"id": "172688", "name": "Wholewheat bread", "kcal": 252.0, "protein": 12.45, "fat": 3.5, "carbs": 42.71, "allergens": ["wheat", "gluten"], "vegetarian": true, "vegan": true, "source_description": "Bread, whole-wheat, commercially prepared", "source_url": "https://fdc.nal.usda.gov/food-details/172688/nutrients"}'::jsonb);
insert into public.nutrition_foods values ('169704', '{"id": "169704", "name": "Brown rice \u00b7 cooked", "kcal": 123.0, "protein": 2.74, "fat": 0.97, "carbs": 25.58, "allergens": [], "vegetarian": true, "vegan": true, "source_description": "Rice, brown, long-grain, cooked (Includes foods for USDA''s Food Distribution Program)", "source_url": "https://fdc.nal.usda.gov/food-details/169704/nutrients"}'::jsonb);
insert into public.nutrition_foods values ('171477', '{"id": "171477", "name": "Chicken breast \u00b7 cooked", "kcal": 165.0, "protein": 31.02, "fat": 3.57, "carbs": 0.0, "allergens": [], "vegetarian": false, "vegan": false, "source_description": "Chicken, broilers or fryers, breast, meat only, cooked, roasted", "source_url": "https://fdc.nal.usda.gov/food-details/171477/nutrients"}'::jsonb);
insert into public.nutrition_foods values ('173709', '{"id": "173709", "name": "Tuna \u00b7 water-packed, drained", "kcal": 86.0, "protein": 19.44, "fat": 0.96, "carbs": 0.0, "allergens": ["fish"], "vegetarian": false, "vegan": false, "source_description": "Fish, tuna, light, canned in water, drained solids (Includes foods for USDA''s Food Distribution Program)", "source_url": "https://fdc.nal.usda.gov/food-details/173709/nutrients"}'::jsonb);
insert into public.nutrition_foods values ('172421', '{"id": "172421", "name": "Lentils \u00b7 cooked, no salt", "kcal": 116.0, "protein": 9.02, "fat": 0.38, "carbs": 20.13, "allergens": [], "vegetarian": true, "vegan": true, "source_description": "Lentils, mature seeds, cooked, boiled, without salt", "source_url": "https://fdc.nal.usda.gov/food-details/172421/nutrients"}'::jsonb);
insert into public.nutrition_foods values ('175194', '{"id": "175194", "name": "Kidney beans \u00b7 cooked, no salt", "kcal": 127.0, "protein": 8.67, "fat": 0.5, "carbs": 22.8, "allergens": [], "vegetarian": true, "vegan": true, "source_description": "Beans, kidney, red, mature seeds, cooked, boiled, without salt", "source_url": "https://fdc.nal.usda.gov/food-details/175194/nutrients"}'::jsonb);
insert into public.nutrition_foods values ('172475', '{"id": "172475", "name": "Firm tofu", "kcal": 144.0, "protein": 17.27, "fat": 8.72, "carbs": 2.78, "allergens": ["soy"], "vegetarian": true, "vegan": true, "source_description": "Tofu, raw, firm, prepared with calcium sulfate", "source_url": "https://fdc.nal.usda.gov/food-details/172475/nutrients"}'::jsonb);
insert into public.nutrition_foods values ('169967', '{"id": "169967", "name": "Broccoli \u00b7 cooked", "kcal": 35.0, "protein": 2.38, "fat": 0.41, "carbs": 7.18, "allergens": [], "vegetarian": true, "vegan": true, "source_description": "Broccoli, cooked, boiled, drained, without salt", "source_url": "https://fdc.nal.usda.gov/food-details/169967/nutrients"}'::jsonb);
insert into public.nutrition_foods values ('170393', '{"id": "170393", "name": "Carrot \u00b7 raw", "kcal": 41.0, "protein": 0.93, "fat": 0.24, "carbs": 9.58, "allergens": [], "vegetarian": true, "vegan": true, "source_description": "Carrots, raw", "source_url": "https://fdc.nal.usda.gov/food-details/170393/nutrients"}'::jsonb);
insert into public.nutrition_foods values ('170457', '{"id": "170457", "name": "Tomato \u00b7 raw", "kcal": 18.0, "protein": 0.88, "fat": 0.2, "carbs": 3.89, "allergens": [], "vegetarian": true, "vegan": true, "source_description": "Tomatoes, red, ripe, raw, year round average", "source_url": "https://fdc.nal.usda.gov/food-details/170457/nutrients"}'::jsonb);
insert into public.nutrition_foods values ('168409', '{"id": "168409", "name": "Cucumber \u00b7 raw", "kcal": 15.0, "protein": 0.65, "fat": 0.11, "carbs": 3.63, "allergens": [], "vegetarian": true, "vegan": true, "source_description": "Cucumber, with peel, raw", "source_url": "https://fdc.nal.usda.gov/food-details/168409/nutrients"}'::jsonb);
insert into public.nutrition_foods values ('168484', '{"id": "168484", "name": "Sweet potato \u00b7 boiled", "kcal": 76.0, "protein": 1.37, "fat": 0.14, "carbs": 17.72, "allergens": [], "vegetarian": true, "vegan": true, "source_description": "Sweet potato, cooked, boiled, without skin", "source_url": "https://fdc.nal.usda.gov/food-details/168484/nutrients"}'::jsonb);
insert into public.nutrition_foods values ('171413', '{"id": "171413", "name": "Olive oil", "kcal": 884.0, "protein": 0.0, "fat": 100.0, "carbs": 0.0, "allergens": [], "vegetarian": true, "vegan": true, "source_description": "Oil, olive, salad or cooking", "source_url": "https://fdc.nal.usda.gov/food-details/171413/nutrients"}'::jsonb);
insert into public.nutrition_foods values ('170567', '{"id": "170567", "name": "Almonds", "kcal": 579.0, "protein": 21.15, "fat": 49.93, "carbs": 21.55, "allergens": ["nuts"], "vegetarian": true, "vegan": true, "source_description": "Nuts, almonds", "source_url": "https://fdc.nal.usda.gov/food-details/170567/nutrients"}'::jsonb);
insert into public.nutrition_foods values ('171705', '{"id": "171705", "name": "Avocado", "kcal": 160.0, "protein": 2.0, "fat": 14.66, "carbs": 8.53, "allergens": [], "vegetarian": true, "vegan": true, "source_description": "Avocados, raw, all commercial varieties", "source_url": "https://fdc.nal.usda.gov/food-details/171705/nutrients"}'::jsonb);

create table public.nutrition_goals (
 user_id uuid primary key references public.users(id) on delete cascade,
 settings jsonb not null, result jsonb not null, updated_at timestamptz not null default now()
);
create table public.nutrition_goal_versions (
 user_id uuid not null references public.users(id) on delete cascade,
 effective_day date not null, result jsonb not null, primary key(user_id,effective_day)
);
create table public.saved_meals (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.users(id) on delete cascade,
 name text not null check(length(name) between 1 and 100),
 slot text not null check(slot in ('breakfast','lunch','snack','dinner')),
 items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 30),
 created_at timestamptz not null default now()
);
create table public.nutrition_meal_plans (
 user_id uuid not null references public.users(id) on delete cascade, day date not null,
 plan jsonb not null, source text not null check(source in ('rules','groq')),
 target integer not null, created_at timestamptz not null default now(), primary key(user_id,day)
);
create table public.nutrition_day_status (
 user_id uuid not null references public.users(id) on delete cascade,day date not null,
 complete boolean not null default false, primary key(user_id,day)
);
do $$ declare t text; begin
 foreach t in array array['nutrition_goals','nutrition_goal_versions','nutrition_meal_plans'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy owner_read on public.%I for select to authenticated using ((select auth.uid())=user_id)',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
 foreach t in array array['saved_meals','nutrition_day_status'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy owner_access on public.%I for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
alter table public.calorie_transactions add column log_day date, add column meal_slot text,
 add column meal_snapshot jsonb;
create index calorie_food_day on public.calorie_transactions(user_id,log_day) where kind='food';

-- Service-only atomic goal write preserves targets before today's change.
create function public.save_nutrition_goal(p_user uuid,p_day date,p_settings jsonb,p_result jsonb)
returns void language plpgsql security invoker set search_path='' as $$
begin
 insert into public.nutrition_goals values(p_user,p_settings,p_result,now())
 on conflict(user_id) do update set settings=excluded.settings,result=excluded.result,updated_at=now();
 insert into public.nutrition_goal_versions values(p_user,p_day,p_result)
 on conflict(user_id,effective_day) do update set result=excluded.result;
 insert into public.calorie_bank(user_id,sex,age,height_cm,weight_kg,goal_weight_kg,activity_level,rate_kg_per_week,bmr,tdee,daily_target)
 values(p_user,p_settings->>'sex',(p_settings->>'age')::int,(p_settings->>'height_cm')::numeric,
 (p_settings->>'weight_kg')::numeric,(p_settings->>'goal_weight_kg')::numeric,p_settings->>'activity_level',
 round((p_result->>'monthly_loss_kg')::numeric*7/30,2),(p_result->>'bmr')::int,(p_result->>'maintenance')::int,(p_result->>'target')::int)
 on conflict(user_id) do update set sex=excluded.sex,age=excluded.age,height_cm=excluded.height_cm,weight_kg=excluded.weight_kg,
 goal_weight_kg=excluded.goal_weight_kg,activity_level=excluded.activity_level,rate_kg_per_week=excluded.rate_kg_per_week,
 bmr=excluded.bmr,tdee=excluded.tdee,daily_target=excluded.daily_target,updated_at=now();
end $$;
revoke all on function public.save_nutrition_goal(uuid,date,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_nutrition_goal(uuid,date,jsonb,jsonb) to service_role;

-- One food row is the source of truth. Upsert uses a caller-generated UUID to make retries idempotent.
create function public.log_nutrition_food(p_id uuid,p_day date,p_slot text,p_name text,p_items jsonb default null,p_kcal integer default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare total numeric:=0; i jsonb; f jsonb; grams numeric; snap jsonb:=null; uid uuid:=auth.uid();
begin
 if uid is null or not public.has_active_membership() then raise exception 'Active membership required'; end if;
 if p_day>current_date+1 or p_day<current_date-366 or p_slot not in ('breakfast','lunch','snack','dinner') or length(trim(p_name)) not between 1 and 100 then raise exception 'Check the food details'; end if;
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
  if p_kcal is null or p_kcal<1 or p_kcal>10000 then raise exception 'Enter 1â€“10,000 calories'; end if;
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
end $$;
revoke all on function public.log_nutrition_food(uuid,date,text,text,jsonb,integer) from public,anon;
grant execute on function public.log_nutrition_food(uuid,date,text,text,jsonb,integer) to authenticated;

-- One row per calendar day, including incomplete/empty days, never treat missing entries as fasting.
create function public.nutrition_period(p_day date,p_offset integer default 0)
returns jsonb language sql stable security invoker set search_path='' as $$
 with days as (select generate_series(least(date_trunc('month',p_day)::date,p_day-6),p_day,interval '1 day')::date as day),
 food as (select coalesce(log_day,(occurred_at-make_interval(mins=>p_offset))::date) as day,
 sum(abs(kcal)) kcal,count(*) entries from public.calorie_transactions where user_id=auth.uid() and kind='food'
 and occurred_at>=p_day-40 and occurred_at<p_day+2 group by 1)
 select jsonb_agg(jsonb_build_object('day',d.day,'kcal',coalesce(f.kcal,0),'entries',coalesce(f.entries,0),
 'complete',coalesce(s.complete,false),'target',(v.result->>'target')::int) order by d.day)
 from days d left join food f using(day)
 left join public.nutrition_day_status s on s.user_id=auth.uid() and s.day=d.day
 left join lateral(select result from public.nutrition_goal_versions where user_id=auth.uid() and effective_day<=d.day order by effective_day desc limit 1) v on true
 where p_offset between -840 and 840;
$$;
revoke all on function public.nutrition_period(date,integer) from public,anon;
grant execute on function public.nutrition_period(date,integer) to authenticated;

create function public.nutrition_food_entries(p_day date,p_offset integer default 0)
returns setof public.calorie_transactions language sql stable security invoker set search_path='' as $$
 select * from public.calorie_transactions where user_id=auth.uid() and kind='food'
 and p_offset between -840 and 840
 and coalesce(log_day,(occurred_at-make_interval(mins=>p_offset))::date)=p_day order by occurred_at,id;
$$;
revoke all on function public.nutrition_food_entries(date,integer) from public,anon;
grant execute on function public.nutrition_food_entries(date,integer) to authenticated;
create function public.nutrition_activity() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('sessions',count(*),'oldest',min(w.completed_at),'minutes_per_week',coalesce(sum(w.duration_sec)/60.0/4,0))
 from public.workout_logs w where w.client_id=auth.uid() and w.cancelled_at is null
 and w.completed_at between now()-interval '28 days' and now()
 and w.duration_sec between 1 and 10800 and exists (
 select 1 from public.logged_sets s where s.log_id=w.id and s.client_id=auth.uid()
 and s.completed=true and s.set_type<>'warmup' and (s.reps>0 or s.reps_left>0)
 and not (case when s.programme_exercise_id is not null then 'pe_'||s.programme_exercise_id::text else 'nm_'||s.exercise_name end=any(coalesce(w.excluded_exercises,'{}'))));
$$;
revoke all on function public.nutrition_activity() from public,anon;
grant execute on function public.nutrition_activity() to authenticated;
grant select on public.nutrition_foods to service_role;
