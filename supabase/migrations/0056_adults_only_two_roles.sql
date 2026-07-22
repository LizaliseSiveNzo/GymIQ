-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.

-- 0056: Adults-only, two-role model.
--
-- GymIQ is now a trainer <-> customer product. Everyone is an adult, so the
-- guardian-consent machinery built for under-18 academy players no longer
-- applies.
--
-- Role mapping (internal value -> what the user sees):
--     coach  -> "Trainer"
--     player -> "Customer"
--
-- The enum values are intentionally NOT renamed. 'coach' and 'player' appear as
-- literals in 32 places across RLS policies and SECURITY DEFINER functions;
-- renaming them would break every one of those at once. The labels are a
-- presentation concern and are handled in the UI.
--
-- Self-signup may now choose Trainer or Customer. 'admin' remains impossible to
-- self-assign — that restriction from 0022 is preserved.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_consent   boolean;
  v_requested text;
  v_role      user_role;
begin
  v_consent   := coalesce((new.raw_user_meta_data->>'consent')::boolean, false);
  v_requested := lower(coalesce(new.raw_user_meta_data->>'role', 'player'));

  -- Only these two are self-assignable. Anything else (notably 'admin')
  -- silently falls back to the least-privileged role.
  v_role := case v_requested
              when 'coach'    then 'coach'::user_role
              when 'trainer'  then 'coach'::user_role     -- UI alias
              when 'player'   then 'player'::user_role
              when 'customer' then 'player'::user_role    -- UI alias
              else 'player'::user_role
            end;

  insert into public.users (id, email, name, role, consent_version, consent_accepted_at)
  values (new.id,
          new.email,
          coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
          v_role,
          nullif(new.raw_user_meta_data->>'consent_version', ''),
          case when v_consent then now() else null end);

  return new;
end $$;

-- Guardian/child-consent columns are no longer collected. They are left in
-- place rather than dropped so this migration stays reversible and no existing
-- data is destroyed; Phase 2 can drop them once the UI no longer references
-- them at all.
comment on column public.users.guardian_name is
  'DEPRECATED (0056): adults-only product, no guardian consent collected.';
comment on column public.users.consent_photo_media is
  'DEPRECATED (0056): adults-only product, media consent handled elsewhere.';
