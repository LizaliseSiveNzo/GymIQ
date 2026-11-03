-- A session undo must serialize with finish/cancel, not delete a row from a
-- workout that ended on another device while the local screen was still open.
create function public.undo_session_set(p_log uuid,p_set uuid,p_expected jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare w public.workout_logs; s public.logged_sets;
begin
 if auth.uid() is null then raise exception 'Sign in before changing a set'; end if;
 if not public.has_active_membership() then raise exception 'Active membership is required'; end if;
 select * into w from public.workout_logs where id=p_log and client_id=auth.uid() for update;
 if not found then raise exception 'Workout not found'; end if;
 if w.completed_at is not null or w.cancelled_at is not null then raise exception 'This workout has ended. Reload your history before changing its sets.'; end if;
 select * into s from public.logged_sets where id=p_set and log_id=w.id and client_id=auth.uid() for update;
 if not found then return true; end if; -- A lost undo acknowledgement can retry safely.
 if p_expected is distinct from jsonb_build_object('weight',s.weight,'reps',s.reps,'weight_left',s.weight_left,'reps_left',s.reps_left,'rir',s.rir) then
  raise exception 'This set changed elsewhere. Reload the session before undoing it.';
 end if;
 delete from public.logged_sets where id=s.id and log_id=w.id and client_id=auth.uid();
 -- Immutable sync receipts are deliberately retained, preventing resurrection.
 return true;
end $$;
revoke all on function public.undo_session_set(uuid,uuid,jsonb) from public,anon;
grant execute on function public.undo_session_set(uuid,uuid,jsonb) to authenticated;
