/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { supabase } from './supabaseClient.js';
import { generateProgram } from './engines/generator.js';
import { persistProgram } from './engines/persistProgram.js';

// Rebuild the active programme with a new training goal, preserving the user's
// schedule, focus, equipment and name. save_generated_program deactivates the
// old programme and makes the new one active; completed history is untouched.
export async function rebuildProgramWithGoal(userId, newGoal) {
  const { data: program, error: pErr } = await supabase
    .from('workout_programmes')
    .select('id,name,goal,split,days_per_week,session_minutes,focus_muscle_ids,deprioritized_muscle_ids,color,icon,gym_profile_id')
    .eq('client_id', userId).eq('is_active', true)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (pErr) throw Error('Could not load your programme.');
  if (!program) throw Error('No active programme to update.');
  if (program.goal === newGoal) return null;

  const [profile, equip, catalog] = await Promise.all([
    supabase.from('users').select('training_experience').eq('id', userId).single(),
    program.gym_profile_id
      ? supabase.from('gym_profile_equipment').select('equipment_id,selected').eq('profile_id', program.gym_profile_id)
      : Promise.resolve({ data: [] }),
    supabase.from('exercises').select('id,name,equipment_ids,movement_pattern,primary_muscle_id,secondary_muscle_fraction,cue_text,difficulty,sort_order').eq('is_custom', false),
  ]);

  const experience = profile?.data?.training_experience || 'intermediate';
  const equipmentIds = (equip.data || []).filter((e) => e.selected).map((e) => e.equipment_id);

  const generated = generateProgram({
    goal: newGoal,
    daysPerWeek: program.days_per_week || 4,
    sessionMinutes: Number(program.session_minutes) || 60,
    split: program.split || 'auto',
    experience,
    focus: program.focus_muscle_ids || [],
    deprioritized: program.deprioritized_muscle_ids || [],
    equipmentIds,
    name: program.name || '',
  }, { exercises: catalog.data || [] });

  if (generated.error) throw Error(generated.error);

  await persistProgram(generated, {
    clientId: userId,
    requestId: crypto.randomUUID(),
    gymProfileId: program.gym_profile_id,
    name: program.name || 'Program',
    color: program.color,
    icon: program.icon,
  });
  return generated;
}
