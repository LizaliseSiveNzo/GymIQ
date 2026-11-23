-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.
-- Guardian consent capture (POPIA: children's data requires guardian consent)
alter table public.users
  add column if not exists consent_accepted_at timestamptz,
  add column if not exists consent_version text,
  add column if not exists guardian_name text,
  add column if not exists consent_photo_media boolean not null default false;

comment on column public.users.consent_accepted_at is 'When the account holder / guardian accepted the privacy terms';
comment on column public.users.consent_photo_media is 'Separate, optional consent for photos and video of the player';

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare v_role user_role; v_consent boolean;
begin
  v_role := coalesce((new.raw_user_meta_data->>'role')::user_role, 'player');
  if v_role = 'parent' then v_role := 'player'; end if;
  if v_role = 'admin'  then v_role := 'coach';  end if;
  v_consent := coalesce((new.raw_user_meta_data->>'consent')::boolean, false);
  insert into public.users (id, email, name, role, guardian_name, consent_version,
                            consent_accepted_at, consent_photo_media)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
          v_role,
          nullif(new.raw_user_meta_data->>'guardian_name', ''),
          nullif(new.raw_user_meta_data->>'consent_version', ''),
          case when v_consent then now() else null end,
          coalesce((new.raw_user_meta_data->>'consent_photo_media')::boolean, false));
  return new;
end $function$;
