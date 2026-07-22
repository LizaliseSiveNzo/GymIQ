-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.

-- 0013: Email notification queue + team leaderboard RPC
-- (applied 2026-07-02; trigger pings the email-dispatch edge function via pg_net)

alter table notifications add column if not exists emailed boolean not null default false;
create index if not exists idx_notifications_unemailed on notifications(emailed) where emailed = false;

create extension if not exists pg_net;

create or replace function tg_flush_notification_emails() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url     := 'https://xqfhlpraejcesrvahmez.supabase.co/functions/v1/email-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_KEY>'  -- anon key; see live DB for actual value
    ),
    body    := '{}'::jsonb
  );
  return null;
exception when others then
  return null; -- never let email plumbing break the actual insert
end $$;

drop trigger if exists trg_notifications_email on notifications;
create trigger trg_notifications_email
  after insert on notifications
  for each statement execute function tg_flush_notification_emails();

create or replace function team_leaderboard(p_team uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_team uuid; v_role user_role;
begin
  v_role := current_role_of();
  if v_role = 'admin' then
    v_team := coalesce(p_team, (select id from teams order by name limit 1));
  elsif v_role = 'coach' then
    v_team := coalesce(p_team, (select id from teams where coach_id = auth.uid() order by name limit 1));
    if v_team is null or not exists (select 1 from teams where id = v_team and coach_id = auth.uid()) then
      return '[]'::jsonb;
    end if;
  else
    v_team := (select team_id from players where user_id = auth.uid() limit 1);
  end if;
  if v_team is null then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'pos', t.pos, 'name', t.name, 'position', t.position,
      'rank', t.rank_level, 'score', t.score, 'me', t.me
    ) order by t.pos)
    from (
      select row_number() over (order by player_score(p.id) desc, u.name) as pos,
             coalesce(u.name, 'Player') as name,
             p.position, p.rank_level,
             round(player_score(p.id)) as score,
             (p.user_id = auth.uid()) as me
      from players p
      left join users u on u.id = p.user_id
      where p.team_id = v_team
    ) t
  ), '[]'::jsonb);
end $$;
