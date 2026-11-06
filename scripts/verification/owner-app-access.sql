-- Owner access regression checks; all fixtures and writes are rolled back.
begin;
do $$
declare owner_id uuid;customer uuid:=gen_random_uuid();before_ledger jsonb;access_record public.memberships;
begin
 select user_id into strict owner_id from public.owner_dashboard_access where enabled;
 select jsonb_build_object('membership',(select to_jsonb(m) from public.memberships m where user_id=owner_id),'payments',(select count(*) from public.membership_payments where user_id=owner_id)) into before_ledger;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 set local role authenticated;
 access_record:=public.ensure_membership();
 if access_record.kind<>'owner' or access_record.expires_at<=now() or not public.has_active_membership() then raise exception 'Owner access was not restored';end if;
 reset role;
 if before_ledger<>jsonb_build_object('membership',(select to_jsonb(m) from public.memberships m where user_id=owner_id),'payments',(select count(*) from public.membership_payments where user_id=owner_id)) then raise exception 'Owner access changed the billing ledger';end if;
 insert into auth.users(id,email,created_at,updated_at,raw_user_meta_data) values(customer,customer::text||'@example.invalid',now(),now(),'{"name":"Owner access fixture","consent":true,"role":"admin","owner":true}');
 insert into public.memberships(user_id,kind,expires_at) values(customer,'trial',now()-interval '2 days');
 perform set_config('request.jwt.claim.sub',customer::text,true);
 set local role authenticated;
 access_record:=public.ensure_membership();
 if public.has_active_membership() or access_record.kind='owner' or access_record.expires_at>now() then raise exception 'Expired customer bypassed membership';end if;
 begin
  insert into public.workout_logs(client_id,log_date) values(customer,current_date);
  raise exception 'Expired customer could create a workout';
 exception when insufficient_privilege then null;end;
 reset role;
 insert into public.owner_dashboard_access(user_id) values(customer);
 set local role authenticated;
 if not public.has_active_membership() or (public.ensure_membership()).kind<>'owner' then raise exception 'Configured owner was blocked';end if;
 insert into public.workout_logs(client_id,log_date) values(customer,current_date);
 reset role;
 update public.owner_dashboard_access set enabled=false where user_id=customer;
 set local role authenticated;
 if public.has_active_membership() or (public.ensure_membership()).kind='owner' then raise exception 'Disabled owner retained server access';end if;
 reset role;
 update public.memberships set kind='paid',expires_at=now()+interval '30 days' where user_id=customer;
 set local role authenticated;
 if not public.has_active_membership() or (public.ensure_membership()).kind<>'paid' then raise exception 'Paid customer access regressed';end if;
 reset role;
 if has_function_privilege('anon','public.owner_has_app_access()','execute') or has_table_privilege('authenticated','public.owner_dashboard_access','insert') then raise exception 'Owner registry permissions leaked';end if;
end $$;
select 'Owner, expired customer, paid customer, write policies, revocation and unchanged billing checks passed' as verification;
rollback;
