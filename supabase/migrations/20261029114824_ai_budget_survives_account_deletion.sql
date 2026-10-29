-- Anonymous provider-call timestamps survive account deletion, so the global
-- free-tier allowance cannot be reset by removing user-owned review history.
create table public.ai_provider_requests (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now()
);
create index idx_ai_provider_requests_recent on public.ai_provider_requests(created_at desc);
alter table public.ai_provider_requests enable row level security;
revoke all on public.ai_provider_requests from public,anon,authenticated;
grant all on public.ai_provider_requests to service_role;
-- Preserve already-reserved calls when introducing the independent budget.
insert into public.ai_provider_requests(created_at) select created_at from public.ai_review_attempts;

create or replace function public.reserve_ai_review(p_user uuid,p_domain text,p_hash text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare attempt_id uuid; since_day timestamptz:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
begin
 if p_domain not in ('training','nutrition') or p_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid review'; end if;
 perform pg_advisory_xact_lock(hashtextextended('gymiq:groq:budget',0));
 if (select count(*) from public.ai_review_attempts where user_id=p_user and review_domain=p_domain and created_at>=since_day)>=2 then return jsonb_build_object('status','user_limit'); end if;
 if exists(select 1 from public.ai_review_attempts where user_id=p_user and review_domain=p_domain and snapshot_hash=p_hash and created_at>now()-interval '1 minute') then return jsonb_build_object('status','busy'); end if;
 if (select count(*) from public.ai_provider_requests where created_at>=since_day)>=50 then return jsonb_build_object('status','app_limit'); end if;
 if (select count(*) from public.ai_provider_requests where created_at>now()-interval '1 minute')>=2 then return jsonb_build_object('status','busy'); end if;
 delete from public.ai_provider_requests where created_at<now()-interval '60 days';
 insert into public.ai_provider_requests default values;
 insert into public.ai_review_attempts(user_id,review_domain,snapshot_hash) values(p_user,p_domain,p_hash) returning id into attempt_id;
 return jsonb_build_object('status','reserved','id',attempt_id);
end $$;
revoke all on function public.reserve_ai_review(uuid,text,text) from public,anon,authenticated;
grant execute on function public.reserve_ai_review(uuid,text,text) to service_role;
