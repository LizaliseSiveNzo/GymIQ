-- Multi-plan billing: R100/30d, R300/90d, R600/180d, R1200/365d.
-- The old table only allowed amount = 10000 (R100). Relax it and track duration.
alter table public.membership_payments drop constraint if exists membership_payments_amount_check;
alter table public.membership_payments add column if not exists duration_days integer not null default 30;
alter table public.membership_payments add constraint membership_payments_amount_check check (amount in (10000, 30000, 60000, 120000));

-- Extend membership by the paid plan's duration instead of a hardcoded 30 days.
create or replace function public.confirm_yoco_payment(p_checkout text, p_payment text, p_mode text)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare payment public.membership_payments;
begin
 select * into payment from public.membership_payments where checkout_id=p_checkout for update;
 if not found then raise exception 'Unknown checkout'; end if;
 if payment.mode <> p_mode then raise exception 'Payment mode mismatch'; end if;
 if payment.paid_at is not null then return; end if;
 update public.membership_payments set payment_id=p_payment, paid_at=now() where checkout_id=p_checkout;
 if p_mode='live' then
   perform pg_advisory_xact_lock(hashtextextended('premium-invite:'||payment.user_id::text,0));
   insert into public.memberships(user_id,kind,expires_at)
   values(payment.user_id,'paid',greatest(now(),coalesce((select max(g.expires_at) from public.premium_access_grants g join public.premium_access_codes c on c.id=g.code_id where g.user_id=payment.user_id and c.revoked_at is null),now()))+make_interval(days => coalesce(payment.duration_days,30)))
   on conflict(user_id) do update set kind='paid',
     expires_at=greatest(public.memberships.expires_at,now(),coalesce((select max(g.expires_at) from public.premium_access_grants g join public.premium_access_codes c on c.id=g.code_id where g.user_id=payment.user_id and c.revoked_at is null),now()))+make_interval(days => coalesce(payment.duration_days,30));
 end if;
end $function$;
revoke all on function public.confirm_yoco_payment(text,text,text) from public,anon,authenticated;
grant execute on function public.confirm_yoco_payment(text,text,text) to service_role;
