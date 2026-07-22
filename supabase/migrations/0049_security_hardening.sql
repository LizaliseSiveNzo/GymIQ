-- Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
-- Security hardening: no self-elevation, scoped announcement files, trial insert,
-- announcement_recipients policies, search_path.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare v_consent boolean;
begin
  v_consent := coalesce((new.raw_user_meta_data->>'consent')::boolean, false);
  insert into public.users (id, email, name, role, guardian_name, consent_version,
                            consent_accepted_at, consent_photo_media)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
          'player',                      -- forced; ignores any role in metadata
          nullif(new.raw_user_meta_data->>'guardian_name', ''),
          nullif(new.raw_user_meta_data->>'consent_version', ''),
          case when v_consent then now() else null end,
          coalesce((new.raw_user_meta_data->>'consent_photo_media')::boolean, false));
  return new;
end $function$;

create or replace function public.admin_set_role(p_user uuid, p_role user_role)
returns json language plpgsql security definer set search_path to 'public' as $function$
begin
  if current_role_of() <> 'admin' then return json_build_object('ok', false, 'error', 'Admins only'); end if;
  if p_role = 'admin' then return json_build_object('ok', false, 'error', 'Admin role must be granted directly in the database'); end if;
  update users set role = p_role where id = p_user;
  return json_build_object('ok', true);
end $function$;

drop policy if exists ann_files_read on storage.objects;
create policy ann_files_read on storage.objects for select
using (bucket_id = 'announcement-files' and (
    (select current_role_of()) = 'admin'::user_role
    or (storage.foldername(name))[1] in (select t::text from fn_coach_team_ids() t)
    or (storage.foldername(name))[1] = (select fn_my_team_id())::text));

drop policy if exists trialreg_public_insert on public.trial_registrations;

drop policy if exists annrec_admin on public.announcement_recipients;
create policy annrec_admin on public.announcement_recipients for all
  using ((select current_role_of()) = 'admin'::user_role);
drop policy if exists annrec_coach on public.announcement_recipients;
create policy annrec_coach on public.announcement_recipients for all
  using (announcement_id in (select a.id from announcements a where a.team_id in (select fn_coach_team_ids())))
  with check (announcement_id in (select a.id from announcements a where a.team_id in (select fn_coach_team_ids())));
drop policy if exists annrec_player_read on public.announcement_recipients;
create policy annrec_player_read on public.announcement_recipients for select
  using (player_id in (select fn_my_player_ids()));

alter function public.rank_from_score(numeric) set search_path to 'public';

-- Storage: restrict uploads (also applied via storage.buckets update)
update storage.buckets set file_size_limit = 209715200,
  allowed_mime_types = array['image/*','video/*','application/pdf']
where id in ('player-files','announcement-files');
