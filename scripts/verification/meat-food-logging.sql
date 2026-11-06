-- Validate real logging RPC calculations; every diary change is rolled back.
begin;
do $$
declare owner_id uuid;entry_id uuid:=gen_random_uuid();calories int;
begin
 select user_id into strict owner_id from public.owner_dashboard_access where enabled;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 set local role authenticated;
 perform public.log_nutrition_food(entry_id,current_date,'lunch','Protein catalogue verification','[{"food_id":"167634","grams":150}]');
 select kcal into calories from public.calorie_transactions where id=entry_id and user_id=owner_id;
 if calories<>-351 then raise exception 'Mutton calorie calculation mismatch';end if;
 perform public.log_nutrition_food(entry_id,current_date,'lunch','Protein catalogue verification','[{"food_id":"174030","grams":100}]');
 select kcal into calories from public.calorie_transactions where id=entry_id;
 if calories<>-176 then raise exception 'Raw mince calculation mismatch';end if;
 perform public.log_nutrition_food(entry_id,current_date,'lunch','Protein catalogue verification','[{"food_id":"171794","grams":100}]');
 select kcal into calories from public.calorie_transactions where id=entry_id;
 if calories<>-230 then raise exception 'Cooked mince calculation mismatch';end if;
 perform public.log_nutrition_food(entry_id,current_date,'dinner','Protein catalogue verification','[{"food_id":"174618","grams":100}]');
 select kcal into calories from public.calorie_transactions where id=entry_id;
 if calories<>-332 then raise exception 'Sausage calculation mismatch';end if;
 reset role;
end $$;
select 'Meat catalogue logging verified; all test diary edits rolled back' as verification;
rollback;
