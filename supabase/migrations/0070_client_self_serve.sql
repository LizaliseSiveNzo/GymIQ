-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.

-- 0070: Let clients manage their own programme, nutrition and schedule.
-- Structural tables gain a client-owns policy (client_id = auth.uid()) alongside
-- the existing trainer policy, so trainer + client can both edit a client's plan.
-- Appointments: trainer_id becomes optional (solo workout) and clients get full
-- control of their own rows so they can self-schedule.

do $$
declare t text;
begin
  foreach t in array array['workout_programmes','programme_days','programme_exercises',
                           'nutrition_plans','meal_plan_items']
  loop
    execute format(
      'create policy %1$s_client_all on %1$s for all
         using (client_id = auth.uid()) with check (client_id = auth.uid());', t);
  end loop;
end $$;

alter table appointments alter column trainer_id drop not null;
create policy appt_client_all on appointments for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());
