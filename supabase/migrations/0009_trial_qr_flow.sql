-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.

-- Phase 6: trial QR check-in
create policy trialreg_staff_update on trial_registrations for update
  using (current_role_of() in ('admin','coach'));

create or replace function get_trial_by_token(p_token text)
returns json language plpgsql stable security definer set search_path = public as $$
declare t record;
begin
  select tr.id, tr.date, tr.sport, o.name as org_name into t
    from trials tr left join organisations o on o.id = tr.org_id where tr.qr_token = p_token;
  if t.id is null then return null; end if;
  return json_build_object('id', t.id, 'date', t.date, 'sport', t.sport, 'org_name', t.org_name);
end; $$;

create or replace function register_trialist(
  p_token text, p_child text, p_age int, p_position text, p_parent text, p_phone text, p_email text)
returns json language plpgsql security definer set search_path = public as $$
declare tid uuid;
begin
  select id into tid from trials where qr_token = p_token;
  if tid is null then return json_build_object('ok', false, 'error', 'Trial not found'); end if;
  if coalesce(trim(p_child),'') = '' or coalesce(trim(p_parent),'') = '' then
    return json_build_object('ok', false, 'error', 'Child and parent name are required'); end if;
  insert into trial_registrations (trial_id, child_name, child_age, position, parent_name, parent_phone, parent_email)
    values (tid, p_child, p_age, p_position, p_parent, p_phone, p_email);
  return json_build_object('ok', true);
end; $$;

create or replace function set_trial_outcome(p_reg uuid, p_outcome text, p_notes text)
returns json language plpgsql security definer set search_path = public as $$
declare rec record; msg text; matched uuid;
begin
  if current_role_of() not in ('admin','coach') then return json_build_object('ok', false, 'error', 'Not authorized'); end if;
  update trial_registrations set outcome = p_outcome::trial_outcome, coach_notes = coalesce(p_notes, coach_notes)
    where id = p_reg returning * into rec;
  if rec.id is null then return json_build_object('ok', false, 'error', 'Registration not found'); end if;
  msg := format('Hi %s, we have reviewed %s''s trial. Outcome: %s. — GymIQ', rec.parent_name, rec.child_name, rec.outcome);
  select id into matched from users where lower(email) = lower(rec.parent_email) limit 1;
  if matched is not null then insert into notifications (user_id, message) values (matched, msg); end if;
  return json_build_object('ok', true, 'message', msg, 'notified', matched is not null);
end; $$;
