-- Private cached Microsoft speech. Clients access it only through the authenticated function.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('coach-speech','coach-speech',false,5000000,array['audio/mpeg']) on conflict(id) do nothing;
create table public.coach_speech_jobs(
 turn_id uuid not null references public.coach_turns(id) on delete cascade,
 user_id uuid not null references public.users(id) on delete cascade,
 voice text not null, state text not null check(state in ('processing','ready','failed')),
 updated_at timestamptz not null default now(),primary key(turn_id,voice)
);
create table public.coach_speech_usage(
 id bigint generated always as identity primary key,
 user_id uuid not null references public.users(id) on delete cascade,
 chars integer not null check(chars between 1 and 8000),created_at timestamptz not null default now()
);
create index coach_speech_usage_time on public.coach_speech_usage(created_at);
create index coach_speech_usage_owner_time on public.coach_speech_usage(user_id,created_at);
alter table public.coach_speech_jobs enable row level security;
alter table public.coach_speech_usage enable row level security;
revoke all on public.coach_speech_jobs,public.coach_speech_usage from public,anon,authenticated;
grant all on public.coach_speech_jobs,public.coach_speech_usage to service_role;
grant usage,select on sequence public.coach_speech_usage_id_seq to service_role;
create function public.reserve_coach_speech(p_user uuid,p_turn uuid,p_voice text,p_daily_cap integer default 1000000) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare n integer; existing public.coach_speech_jobs; utcday timestamptz:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
begin
 if p_voice<>'en-ZA-LeahNeural' then raise exception 'Unsupported voice'; end if;
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
-- Include service-owned cached audio in the existing account-deletion cleanup.
create or replace function public.account_storage_objects(p_user uuid) returns table(bucket_id text,name text)
language sql stable security definer set search_path='' as $$
 select bucket_id,name from storage.objects where owner_id=p_user::text or owner=p_user
 or (bucket_id='coach-speech' and split_part(name,'/',1)=p_user::text);
$$;
