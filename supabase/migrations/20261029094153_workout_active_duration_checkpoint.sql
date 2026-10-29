-- An unfinished workout stores observed active time, never wall-clock record age.
-- Monotonic checkpoints cannot regress time or overwrite a finished workout.
create function public.checkpoint_workout_duration(p_log uuid, p_duration integer)
returns integer language plpgsql security invoker set search_path = '' as $$
declare result integer;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_duration is null or p_duration < 0 or p_duration > 604800 then
    raise exception 'Invalid workout duration';
  end if;
  update public.workout_logs
    set duration_sec = greatest(coalesce(duration_sec, 0), p_duration)
    where id = p_log and client_id = auth.uid() and completed_at is null
    returning duration_sec into result;
  if not found then raise exception 'Open workout not found'; end if;
  return result;
end $$;
revoke all on function public.checkpoint_workout_duration(uuid, integer) from public, anon;
grant execute on function public.checkpoint_workout_duration(uuid, integer) to authenticated;
