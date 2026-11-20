-- User-taught barcodes: when a product isn't in Open Food Facts, the user enters
-- its name/calories once and the app remembers barcode -> product for next time.
create table if not exists public.user_product_barcodes (
  barcode text not null,
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  kcal_per_100 numeric,
  protein_per_100 numeric,
  carbs_per_100 numeric,
  fat_per_100 numeric,
  unit text not null default 'g',
  brand text,
  created_at timestamptz not null default now(),
  primary key (barcode, user_id)
);
alter table public.user_product_barcodes enable row level security;
drop policy if exists user_product_barcodes_own on public.user_product_barcodes;
create policy user_product_barcodes_own on public.user_product_barcodes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
