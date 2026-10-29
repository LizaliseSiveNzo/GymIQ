-- Immutable receipts make retries safe, including a lost response followed by a deletion.
create table public.log_sync_receipts (
 user_id uuid not null references public.users(id) on delete cascade,
 mutation_id uuid not null, kind text not null check(kind in ('food','set')),
 payload jsonb not null check(octet_length(payload::text)<=16000),
 created_at timestamptz not null default now(), primary key(user_id,mutation_id)
);
alter table public.log_sync_receipts enable row level security;
revoke all on public.log_sync_receipts from anon,authenticated;
grant select,insert on public.log_sync_receipts to authenticated;
grant all on public.log_sync_receipts to service_role;
create policy receipts_owner_read on public.log_sync_receipts for select to authenticated using(user_id=(select auth.uid()));
create policy receipts_owner_insert on public.log_sync_receipts for insert to authenticated with check(user_id=(select auth.uid()));

create table public.food_favourites (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 100),
 slot text not null check(slot in ('breakfast','lunch','snack','dinner')),
 items jsonb, kcal integer check(kcal between 1 and 10000),
 created_at timestamptz not null default now(),
 fingerprint text generated always as (md5(name||'|'||slot||'|'||coalesce(items::text,'')||'|'||coalesce(kcal::text,''))) stored,
 unique(user_id,fingerprint),
 check((items is null and kcal is not null) or (items is not null and kcal is null and jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 30))
);
alter table public.food_favourites enable row level security;
revoke all on public.food_favourites from anon,authenticated;
grant select,insert,update,delete on public.food_favourites to authenticated;
grant all on public.food_favourites to service_role;
create policy favourites_owner on public.food_favourites for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create function public.sync_log_entry(p_id uuid,p_kind text,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
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
 if not public.has_active_membership() then raise exception 'Active membership required to sync'; end if;
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
end $$;
revoke all on function public.sync_log_entry(uuid,text,jsonb) from public,anon;
grant execute on function public.sync_log_entry(uuid,text,jsonb) to authenticated;

-- Public product data stays separate from the curated meal-planner ingredient database.
create table public.barcode_product_cache(barcode text primary key check(barcode ~ '^[0-9]{8,14}$'),product jsonb not null,fetched_at timestamptz not null default now());
alter table public.barcode_product_cache enable row level security;
revoke all on public.barcode_product_cache from anon,authenticated;
grant all on public.barcode_product_cache to service_role;
create table public.barcode_lookup_requests(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.users(id) on delete cascade,created_at timestamptz not null default now());
create index barcode_requests_time on public.barcode_lookup_requests(created_at);
alter table public.barcode_lookup_requests enable row level security;
revoke all on public.barcode_lookup_requests from anon,authenticated;
grant all on public.barcode_lookup_requests to service_role;
create function public.reserve_barcode_lookup(p_user uuid) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('gymiq-barcode-budget',0));
 delete from public.barcode_lookup_requests where created_at<now()-interval '1 day';
 if (select count(*) from public.barcode_lookup_requests where created_at>now()-interval '1 minute')>=12 or (select count(*) from public.barcode_lookup_requests where user_id=p_user and created_at>now()-interval '1 minute')>=4 then return false;end if;
 insert into public.barcode_lookup_requests(user_id) values(p_user);return true;
end $$;
revoke all on function public.reserve_barcode_lookup(uuid) from public,anon,authenticated;
grant execute on function public.reserve_barcode_lookup(uuid) to service_role;
