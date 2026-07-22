-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.

-- Phase 1 (item 4): richer Player Information + safeguarding contacts
alter table public.players
  add column if not exists shirt_number         integer,
  add column if not exists guardian_name        text,
  add column if not exists guardian_phone       text,
  add column if not exists guardian_email       text,
  add column if not exists emergency_contact    text,
  add column if not exists emergency_phone      text,
  add column if not exists allergies            text;

comment on column public.players.emergency_contact is 'Emergency contact name - required for safeguarding of minors';
