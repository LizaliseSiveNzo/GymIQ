-- Richer per-match stats + leaderboard aggregation.
alter table public.player_match_stats add column if not exists shots int not null default 0;
alter table public.player_match_stats add column if not exists shots_on_target int not null default 0;
alter table public.player_match_stats add column if not exists key_passes int not null default 0;
alter table public.player_match_stats add column if not exists passes_completed int not null default 0;
alter table public.player_match_stats add column if not exists passes_attempted int not null default 0;
alter table public.player_match_stats add column if not exists ball_carries int not null default 0;
alter table public.player_match_stats add column if not exists dribbles int not null default 0;
alter table public.player_match_stats add column if not exists tackles int not null default 0;
alter table public.player_match_stats add column if not exists interceptions int not null default 0;
alter table public.player_match_stats add column if not exists clearances int not null default 0;
alter table public.player_match_stats add column if not exists blocks int not null default 0;
alter table public.player_match_stats add column if not exists saves int not null default 0;
alter table public.player_match_stats add column if not exists fouls_won int not null default 0;
alter table public.player_match_stats add column if not exists fouls_committed int not null default 0;

create or replace function stat_leaderboard()
returns table(
  player_id uuid, name text, play_position text, team_name text, rank_level text, games int,
  avg_minutes numeric, avg_rating numeric,
  avg_goals numeric, tot_goals int, avg_assists numeric, tot_assists int,
  avg_shots numeric, avg_shots_on_target numeric, avg_key_passes numeric,
  avg_passes_completed numeric, pass_accuracy numeric,
  avg_ball_carries numeric, avg_dribbles numeric,
  avg_tackles numeric, avg_interceptions numeric, avg_clearances numeric, avg_blocks numeric,
  avg_def_contributions numeric, tot_def_contributions int, avg_saves numeric
) language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select org_id into v_org from users where id = auth.uid();
  return query
  select p.id, u.name, p.position, tm.name, p.rank_level::text, count(s.*)::int,
    round(avg(s.minutes_played),1), round(avg(s.rating),2),
    round(avg(s.goals),2), coalesce(sum(s.goals),0)::int,
    round(avg(s.assists),2), coalesce(sum(s.assists),0)::int,
    round(avg(s.shots),2), round(avg(s.shots_on_target),2), round(avg(s.key_passes),2),
    round(avg(s.passes_completed),1),
    case when sum(s.passes_attempted) > 0 then round(100.0 * sum(s.passes_completed) / sum(s.passes_attempted)) else 0 end,
    round(avg(s.ball_carries),2), round(avg(s.dribbles),2),
    round(avg(s.tackles),2), round(avg(s.interceptions),2), round(avg(s.clearances),2), round(avg(s.blocks),2),
    round(avg(s.tackles + s.interceptions + s.clearances + s.blocks),2),
    coalesce(sum(s.tackles + s.interceptions + s.clearances + s.blocks),0)::int,
    round(avg(s.saves),2)
  from players p join users u on u.id = p.user_id join teams tm on tm.id = p.team_id
  join player_match_stats s on s.player_id = p.id
  where (v_org is null or tm.org_id = v_org)
  group by p.id, u.name, p.position, tm.name, p.rank_level
  having count(s.*) > 0 order by u.name;
end; $$;

grant execute on function stat_leaderboard() to authenticated;
