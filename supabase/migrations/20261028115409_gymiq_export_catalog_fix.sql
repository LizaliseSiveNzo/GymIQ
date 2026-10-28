create or replace function public.export_my_data() returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb := '{}'::jsonb; t record; rows jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 for t in
 select c.relname as table_name, a.attname as owner_column
 from pg_catalog.pg_class c
 join pg_catalog.pg_namespace n on n.oid=c.relnamespace
 join pg_catalog.pg_attribute a on a.attrelid=c.oid
 where n.nspname='public' and c.relkind in ('r','p') and a.attnum>0 and not a.attisdropped
 and a.atttypid='uuid'::regtype and
 (a.attname in ('user_id','client_id','owner_user_id') or(c.relname='users' and a.attname='id'))
 and has_table_privilege(current_user,c.oid,'SELECT')
 loop
 execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from public.%I r where %I=$1',t.table_name,t.owner_column)
 into rows using auth.uid();
 result := result || jsonb_build_object(t.table_name,rows);
 end loop;
 select coalesce(jsonb_agg(to_jsonb(e)),'[]'::jsonb) into rows from public.gym_profile_equipment e
 where profile_id in (select id from public.gym_profiles where user_id=auth.uid());
 return result || jsonb_build_object('gym_profile_equipment',rows);
end $$;
revoke all on function public.export_my_data() from public,anon;
grant execute on function public.export_my_data() to authenticated;
