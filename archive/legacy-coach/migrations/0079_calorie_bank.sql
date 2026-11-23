-- 0079_calorie_bank
-- The Calorie Bank: a running "account" of calories. A monthly allowance is
-- deposited; food withdraws; exercise deposits. Balance ROLLS OVER month to
-- month (never resets). daily_target is computed by the app (Mifflin-St Jeor
-- BMR x activity, adjusted toward goal weight) and stored here.

create table if not exists calorie_bank (
  user_id uuid primary key references users(id) on delete cascade,
  sex text check (sex in ('male','female')),
  age int,
  height_cm numeric(5,1),
  weight_kg numeric(5,1),
  goal_weight_kg numeric(5,1),
  activity_level text default 'moderate'
    check (activity_level in ('sedentary','light','moderate','active','very_active')),
  rate_kg_per_week numeric(3,2) not null default 0.5,
  bmr int, tdee int, daily_target int,
  start_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists calorie_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  kind text not null check (kind in ('deposit','food','exercise','adjust')),
  kcal int not null,                 -- signed: deposit/exercise +, food -
  label text,
  created_at timestamptz not null default now()
);
create index if not exists idx_caltx_user_time on calorie_transactions(user_id, occurred_at desc);

alter table calorie_bank enable row level security;
alter table calorie_transactions enable row level security;
create policy cb_owner_all on calorie_bank for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ctx_owner_all on calorie_transactions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on calorie_bank, calorie_transactions to authenticated;

create or replace function ensure_month_deposit(uid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare dt int; days int; monthly int; mstart date;
begin
  if uid <> auth.uid() then return; end if;
  select daily_target into dt from calorie_bank where user_id = uid;
  if dt is null then return; end if;
  mstart := date_trunc('month', now())::date;
  days := extract(day from (mstart + interval '1 month' - interval '1 day'))::int;
  monthly := dt * days;
  if not exists (
    select 1 from calorie_transactions
    where user_id = uid and kind = 'deposit'
      and date_trunc('month', occurred_at) = date_trunc('month', now())
  ) then
    insert into calorie_transactions (user_id, occurred_at, kind, kcal, label)
    values (uid, mstart, 'deposit', monthly, 'Monthly allowance — ' || to_char(mstart, 'Mon YYYY'));
  end if;
end $$;
revoke execute on function ensure_month_deposit(uuid) from public, anon;
grant execute on function ensure_month_deposit(uuid) to authenticated;

create or replace function calorie_balance(uid uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(kcal), 0)::int from calorie_transactions where user_id = uid and uid = auth.uid();
$$;
revoke execute on function calorie_balance(uuid) from public, anon;
grant execute on function calorie_balance(uuid) to authenticated;
