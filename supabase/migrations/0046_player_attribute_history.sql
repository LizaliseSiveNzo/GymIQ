-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.
-- Phase 4 (item 5): attribute ratings tracked over time
create table if not exists public.player_attribute_history (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  attribute text not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  recorded_by uuid references public.users(id) on delete set null,
  recorded_at timestamptz not null default now()
);
create index if not exists idx_pah_player_attr on public.player_attribute_history(player_id, attribute, recorded_at);
create index if not exists idx_pah_player_time on public.player_attribute_history(player_id, recorded_at);
alter table public.player_attribute_history enable row level security;
drop policy if exists pah_coach on public.player_attribute_history;
create policy pah_coach on public.player_attribute_history for all
  using (player_id in (select fn_coach_player_ids())) with check (player_id in (select fn_coach_player_ids()));
drop policy if exists pah_player_read on public.player_attribute_history;
create policy pah_player_read on public.player_attribute_history for select
  using (player_id in (select fn_my_player_ids()));
drop policy if exists pah_admin on public.player_attribute_history;
create policy pah_admin on public.player_attribute_history for all using (current_role_of() = 'admin');

create or replace function public.tg_snapshot_attribute()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if (tg_op = 'INSERT') or (new.rating is distinct from old.rating) then
    insert into player_attribute_history (player_id, attribute, rating, recorded_by)
    values (new.player_id, new.attribute, new.rating, auth.uid());
  end if;
  return new;
end $function$;

drop trigger if exists trg_snapshot_attribute on public.player_attributes;
create trigger trg_snapshot_attribute
  after insert or update on public.player_attributes
  for each row execute function public.tg_snapshot_attribute();

insert into public.player_attribute_history (player_id, attribute, rating, recorded_at)
select pa.player_id, pa.attribute, pa.rating, now() from public.player_attributes pa
where not exists (select 1 from public.player_attribute_history h
                  where h.player_id = pa.player_id and h.attribute = pa.attribute);
