create or replace function public.log_nutrition_food(p_id uuid,p_day date,p_slot text,p_name text,p_items jsonb default null,p_kcal integer default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare total numeric:=0; i jsonb; f jsonb; grams numeric; snap jsonb:=null; uid uuid:=auth.uid();
begin
 if uid is null or not public.has_active_membership() then raise exception 'Active membership required'; end if;
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


-- Invalidate completion atomically even for direct edits or deletes of diary rows.
create function public.invalidate_nutrition_day() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP<>'INSERT' and OLD.kind='food' and OLD.log_day is not null then
 delete from public.nutrition_day_status where user_id=OLD.user_id and day=OLD.log_day;
 end if;
 if TG_OP<>'DELETE' and NEW.kind='food' and NEW.log_day is not null then
 delete from public.nutrition_day_status where user_id=NEW.user_id and day=NEW.log_day;
 end if;
 if TG_OP='DELETE' then return OLD; else return NEW; end if;
end $$;
revoke all on function public.invalidate_nutrition_day() from public,anon,authenticated;
create trigger invalidate_nutrition_day after insert or update or delete on public.calorie_transactions
for each row execute function public.invalidate_nutrition_day();
