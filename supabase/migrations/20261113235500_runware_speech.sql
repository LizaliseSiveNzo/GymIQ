-- Switch coach read-aloud to Runware (HeyGen voice).
-- Relaxes the voice check so changing the TTS voice later does not need a new migration.
create or replace function public.reserve_coach_speech(p_user uuid,p_turn uuid,p_voice text,p_daily_cap integer default 1000000) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare n integer; existing public.coach_speech_jobs; utcday timestamptz:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
begin
 if p_voice is null or length(p_voice)<1 or length(p_voice)>64 then raise exception 'Unsupported voice'; end if;
 if not exists(select 1 from public.personal_coach_access where user_id=p_user and enabled) then raise exception 'Coach access required'; end if;
 select length(reply) into n from public.coach_turns where id=p_turn and user_id=p_user and status='done';
 if n is null or n not between 1 and 8000 then raise exception 'Reply unavailable for speech'; end if;
 perform pg_advisory_xact_lock(hashtext('gymiq-speech-reservation'));
 select * into existing from public.coach_speech_jobs where turn_id=p_turn and voice=p_voice;
 if existing.state='ready' then return jsonb_build_object('status','cached'); end if;
 if existing.state='processing' and existing.updated_at>now()-interval '2 minutes' then return jsonb_build_object('status','busy'); end if;
 if (select coalesce(sum(chars),0) from public.coach_speech_usage where created_at>=utcday)+n>greatest(1,least(p_daily_cap,10000000))
 or (select coalesce(sum(chars),0) from public.coach_speech_usage where user_id=p_user and created_at>=utcday)+n>30000
 or (select count(*) from public.coach_speech_usage where created_at>now()-interval '1 minute')>=120
 or (select count(*) from public.coach_speech_usage where user_id=p_user and created_at>now()-interval '1 minute')>=6
 then return jsonb_build_object('status','limited'); end if;
 insert into public.coach_speech_usage(user_id,chars) values(p_user,n);
 insert into public.coach_speech_jobs(turn_id,user_id,voice,state) values(p_turn,p_user,p_voice,'processing')
 on conflict(turn_id,voice) do update set state='processing',updated_at=now();
 return jsonb_build_object('status','generate');
end $$;
revoke all on function public.reserve_coach_speech(uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.reserve_coach_speech(uuid,uuid,text,integer) to service_role;
