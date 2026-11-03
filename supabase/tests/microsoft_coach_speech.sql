begin;
do $$
declare uid uuid; tid uuid:=gen_random_uuid(); result jsonb;
begin
 select id into uid from public.users where email='gymiq-layout-qa-20261029@example.invalid';
 if uid is null then raise exception 'Disposable QA fixture missing'; end if;
 insert into public.personal_coach_access(user_id,enabled) values(uid,true) on conflict(user_id) do update set enabled=true;
 insert into public.coach_turns(id,user_id,prompt,reply,status) values(tid,uid,'Synthetic speech test','Synthetic test reply','done');
 result:=public.reserve_coach_speech(uid,tid,'en-ZA-LeahNeural');
 if result->>'status'<>'generate' then raise exception 'First reservation failed: %',result; end if;
 result:=public.reserve_coach_speech(uid,tid,'en-ZA-LeahNeural');
 if result->>'status'<>'busy' then raise exception 'Duplicate generation was not blocked'; end if;
 update public.coach_speech_jobs set state='ready' where turn_id=tid;
 result:=public.reserve_coach_speech(uid,tid,'en-ZA-LeahNeural',1);
 if result->>'status'<>'cached' then raise exception 'Cache incorrectly charged'; end if;
 update public.coach_speech_jobs set state='failed' where turn_id=tid;
 result:=public.reserve_coach_speech(uid,tid,'en-ZA-LeahNeural',1);
 if result->>'status'<>'limited' then raise exception 'Budget limit failed'; end if;
 begin perform public.reserve_coach_speech(null,tid,'en-ZA-LeahNeural');raise exception 'Wrong account accepted';exception when others then if sqlerrm='Wrong account accepted' then raise;end if;end;
 if has_function_privilege('authenticated','public.reserve_coach_speech(uuid,uuid,text,integer)','EXECUTE') then raise exception 'Client can reserve paid generation';end if;
 if has_table_privilege('anon','public.coach_speech_jobs','SELECT') then raise exception 'Anonymous cache access';end if;
 if (select public from storage.buckets where id='coach-speech') then raise exception 'Public audio bucket';end if;
end $$;
rollback;
