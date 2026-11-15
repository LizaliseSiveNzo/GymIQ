-- Access codes now grant full app access: premium membership AND the personal AI coach.
create or replace function public.redeem_premium_code(p_user uuid,p_hash text,p_email text default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare code public.premium_access_codes;existing public.premium_access_grants;attempt_count int;until_at timestamptz;
begin
 if p_user is null or not exists(select 1 from public.users where id=p_user) then return jsonb_build_object('ok',false,'error','Sign in first.');end if;
 delete from public.access_code_attempts where user_id=p_user and bucket<now()-interval '7 days';
 insert into public.access_code_attempts(user_id,bucket) values(p_user,date_trunc('hour',now())) on conflict(user_id,bucket) do update set attempts=least(1000,public.access_code_attempts.attempts+1) returning attempts into attempt_count;
 if attempt_count>10 then return jsonb_build_object('ok',false,'error','Too many attempts. Try again in an hour.');end if;
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then return jsonb_build_object('ok',false,'error','This access code is unavailable. Check the code or ask the owner.');end if;
 select * into code from public.premium_access_codes where code_hash=p_hash for update;
 if not found or code.revoked_at is not null then return jsonb_build_object('ok',false,'error','This access code is unavailable. Check the code or ask the owner.');end if;
 if code.bound_email is not null and coalesce(lower(p_email),'')<>code.bound_email then return jsonb_build_object('ok',false,'error','This code is for a different account email.');end if;
 select * into existing from public.premium_access_grants where user_id=p_user and code_id=code.id;
 if found then
  insert into public.personal_coach_access(user_id) values(p_user) on conflict(user_id) do update set enabled=true;
  return jsonb_build_object('ok',true,'already_redeemed',true,'expires_at',existing.expires_at);
 end if;
 if code.expires_at<=now() or code.uses>=code.max_uses then return jsonb_build_object('ok',false,'error','This access code has expired or reached its usage limit.');end if;
 perform pg_advisory_xact_lock(hashtextextended('premium-invite:'||p_user::text,0));
 select greatest(now(),coalesce((select expires_at from public.memberships where user_id=p_user),now()),coalesce((select max(g.expires_at) from public.premium_access_grants g join public.premium_access_codes c on c.id=g.code_id where g.user_id=p_user and c.revoked_at is null),now()))+make_interval(days=>code.days) into until_at;
 insert into public.premium_access_grants(user_id,code_id,expires_at) values(p_user,code.id,until_at);
 insert into public.personal_coach_access(user_id) values(p_user) on conflict(user_id) do update set enabled=true;
 update public.premium_access_codes set uses=uses+1 where id=code.id;
 return jsonb_build_object('ok',true,'expires_at',until_at);
end $$;
