-- Phase 5: ranking engine
-- Score 0-100 = attendance_rate*40 + min(minutes/900,1)*30 + (avg_rating/5)*30

create or replace function rank_from_score(score numeric)
returns rank_level language sql immutable as $$
  select case
    when score >= 85 then 'Grand_Master'
    when score >= 70 then 'Master'
    when score >= 50 then 'Elite'
    when score >= 30 then 'Rising_Star'
    else 'Rookie' end::rank_level $$;

create or replace function player_score(pid uuid)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare tid uuid; total int; att_ct int; rate numeric; mins int; avg_r numeric;
begin
  select team_id into tid from players where id = pid;
  select count(*) into total from training_sessions where team_id = tid;
  select count(*) into att_ct from attendance a where a.player_id = pid and a.attended;
  rate := case when total > 0 then att_ct::numeric / total else 0 end;
  select coalesce(sum(minutes_played),0), coalesce(avg(rating),0) into mins, avg_r
    from player_match_stats where player_id = pid;
  return round(rate*40 + least(mins/900.0, 1)*30 + (avg_r/5)*30, 1);
end; $$;

create or replace function recompute_player_rank(pid uuid)
returns rank_level language plpgsql security definer set search_path = public as $$
declare nr rank_level;
begin
  nr := rank_from_score(player_score(pid));
  update players set rank_level = nr where id = pid;
  return nr;
end; $$;

create or replace function recompute_team_ranks(p_team uuid)
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  if not (current_role_of() = 'admin' or exists (select 1 from teams where id = p_team and coach_id = auth.uid())) then
    return 0; end if;
  for r in select id from players where team_id = p_team loop
    perform recompute_player_rank(r.id); n := n + 1;
  end loop;
  return n;
end; $$;

create or replace function my_player_overview()
returns json language plpgsql security definer set search_path = public as $$
declare pid uuid; tid uuid; pos text; pname text; team_name text; div text;
        total int; att_ct int; rate numeric; mins int; avg_r numeric;
        score numeric; nr rank_level; lo numeric; hi numeric; progress int;
begin
  select p.id, p.team_id, p.position, u.name into pid, tid, pos, pname
    from players p join users u on u.id = p.user_id where p.user_id = auth.uid() limit 1;
  if pid is null then return null; end if;
  select name, division::text into team_name, div from teams where id = tid;
  select count(*) into total from training_sessions where team_id = tid;
  select count(*) into att_ct from attendance a where a.player_id = pid and a.attended;
  rate := case when total > 0 then att_ct::numeric / total else 0 end;
  select coalesce(sum(minutes_played),0), coalesce(avg(rating),0) into mins, avg_r
    from player_match_stats where player_id = pid;
  score := round(rate*40 + least(mins/900.0,1)*30 + (avg_r/5)*30, 1);
  nr := rank_from_score(score);
  update players set rank_level = nr where id = pid;
  if    score >= 85 then lo:=85; hi:=100;
  elsif score >= 70 then lo:=70; hi:=85;
  elsif score >= 50 then lo:=50; hi:=70;
  elsif score >= 30 then lo:=30; hi:=50;
  else lo:=0; hi:=30; end if;
  progress := round((score - lo) / (hi - lo) * 100);
  return json_build_object(
    'name', pname, 'position', pos, 'team', team_name, 'division', div,
    'attendance_pct', round(rate*100), 'minutes', mins, 'avg_rating', round(avg_r,1),
    'rank', nr, 'score', score, 'progress', progress);
end; $$;
