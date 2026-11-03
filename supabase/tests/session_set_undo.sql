-- Transaction-only fixture; no account, membership or workout change persists.
begin;
do $$ declare uid uuid; lid uuid:=gen_random_uuid(); sid uuid:=gen_random_uuid();
begin
 select id into uid from auth.users where email='gymiq-layout-qa-20261029@example.invalid';
 if uid is null then raise exception 'Layout QA fixture is required'; end if;
 update public.memberships set expires_at=now()+interval '1 day' where user_id=uid;
 insert into public.workout_logs(id,client_id,note) values(lid,uid,'freeform');
 insert into public.logged_sets(id,client_id,log_id,exercise_name,set_number,weight,reps,completed) values(sid,uid,lid,'Undo transaction fixture',1,20,6,true);
 perform set_config('request.jwt.claim.sub',uid::text,true);
 perform set_config('gymiq.test.undo.log',lid::text,true);perform set_config('gymiq.test.undo.set',sid::text,true);
end $$;
set local role authenticated;
do $$ declare lid uuid:=current_setting('gymiq.test.undo.log')::uuid; sid uuid:=current_setting('gymiq.test.undo.set')::uuid; expected jsonb:='{"weight":20,"reps":6,"weight_left":null,"reps_left":null,"rir":null}';
begin
 if has_function_privilege('anon','public.undo_session_set(uuid,uuid,jsonb)','EXECUTE') then raise exception 'Anonymous undo is exposed'; end if;
 begin perform public.undo_session_set(lid,sid,expected||'{"weight":25}'::jsonb);raise exception 'Stale undo succeeded';exception when others then if sqlerrm not like 'This set changed elsewhere%' then raise;end if;end;
 if not exists(select 1 from public.logged_sets where id=sid) then raise exception 'Stale undo deleted data';end if;
 perform public.undo_session_set(lid,sid,expected);perform public.undo_session_set(lid,sid,expected);
 if exists(select 1 from public.logged_sets where id=sid) then raise exception 'Undo did not remove the set';end if;
 insert into public.logged_sets(id,client_id,log_id,exercise_name,set_number,weight,reps,completed) values(sid,auth.uid(),lid,'Undo transaction fixture',1,20,6,true);
 update public.workout_logs set completed_at=now() where id=lid;
 begin perform public.undo_session_set(lid,sid,expected);raise exception 'Closed session undo succeeded';exception when others then if sqlerrm not like 'This workout has ended%' then raise;end if;end;
 if not exists(select 1 from public.logged_sets where id=sid) then raise exception 'Closed session lost data';end if;
end $$;
reset role;
rollback;
