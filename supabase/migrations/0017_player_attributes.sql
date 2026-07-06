-- FIFA-style player attributes + physical profile
alter table players add column if not exists strong_foot text;
alter table players add column if not exists weak_foot int check (weak_foot between 1 and 5);
alter table players add column if not exists height_cm int;
alter table players add column if not exists weight_kg numeric(5,1);

create table if not exists player_attributes (
  player_id  uuid not null references players(id) on delete cascade,
  attribute  text not null,
  rating     int not null check (rating between 1 and 5),
  updated_at timestamptz default now(),
  primary key (player_id, attribute)
);
alter table player_attributes enable row level security;

drop policy if exists pa_read on player_attributes;
drop policy if exists pa_write on player_attributes;
create policy pa_read on player_attributes for select using (
  current_role_of() = 'admin'
  or player_id in (select id from players where user_id = auth.uid())
  or player_id in (select id from players where team_id in (select fn_coach_team_ids())));
create policy pa_write on player_attributes for all
  using (current_role_of() = 'admin' or player_id in (select id from players where team_id in (select fn_coach_team_ids())))
  with check (current_role_of() = 'admin' or player_id in (select id from players where team_id in (select fn_coach_team_ids())));

create or replace function player_card(p_player uuid default null)
returns json language plpgsql stable security definer set search_path = public as $$
declare target uuid; tid uuid; ok boolean; rec record;
begin
  target := coalesce(p_player, (select id from players where user_id = auth.uid() limit 1));
  if target is null then return null; end if;
  select p.team_id, p.position, p.strong_foot, p.weak_foot, p.height_cm, p.weight_kg, u.name
    into rec from players p join users u on u.id = p.user_id where p.id = target;
  tid := rec.team_id;
  ok := exists (select 1 from players where id = target and user_id = auth.uid())
     or current_role_of() = 'admin'
     or exists (select 1 from teams where id = tid and coach_id = auth.uid());
  if not ok then return null; end if;
  return json_build_object('name', rec.name, 'position', rec.position,
    'strong_foot', rec.strong_foot, 'weak_foot', rec.weak_foot,
    'height_cm', rec.height_cm, 'weight_kg', rec.weight_kg,
    'attributes', coalesce((select json_object_agg(attribute, rating) from player_attributes where player_id = target), '{}'::json));
end; $$;
