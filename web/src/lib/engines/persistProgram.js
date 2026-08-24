/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { supabase } from '../supabaseClient.js';

/**
 * Persist a generated program tree into the programme tables.
 * Deactivates any previous active programme for this client first.
 * Idempotency is handled by the caller (persist once per wizard run).
 *
 * @param generated output of generateProgram()
 * @param opts {{clientId:string, gymProfileId?:string|null,
 *   name:string, color?:string, icon?:string}}
 */
export async function persistProgram(generated, opts) {
  const { clientId, gymProfileId = null, name, color, icon } = opts;

  // One active programme at a time (legacy rows included).
  await supabase.from('workout_programmes')
    .update({ is_active: false })
    .eq('client_id', clientId)
    .eq('is_active', true);

  const progIns = await supabase.from('workout_programmes').insert({
    client_id: clientId,
    trainer_id: null,
    name,
    is_active: true,
    goal: generated.goal,
    split: generated.split,
    days_per_week: generated.daysPerWeek,
    session_minutes: generated.sessionMinutes,
    focus_muscle_ids: [],
    deprioritized_muscle_ids: [],
    deload_policy: generated.deloadPolicy,
    color: color || '#C6FF3A',
    icon: icon || '💪',
    current_week: 1,
    generated: true,
    source: 'generator',
    gym_profile_id: gymProfileId,
  }).select('id').single();
  if (progIns.error) throw progIns.error;
  const programmeId = progIns.data.id;

  if (generated.weeks?.length) {
    const { error } = await supabase.from('programme_weeks').insert(
      generated.weeks.map((w) => ({
        client_id: clientId, programme_id: programmeId,
        week_number: w.weekNumber, kind: w.kind, volume_multiplier: w.volumeMultiplier,
      })),
    );
    if (error) throw error;
  }

  for (const day of generated.days) {
    const dayIns = await supabase.from('programme_days').insert({
      client_id: clientId,
      programme_id: programmeId,
      name: `${day.label} · ${day.name}`,
      label: day.label,
      focus_summary: (day.focusSummary || []).join(', ') || null,
      sort_order: day.dayIndex ?? 0,
    }).select('id').single();
    if (dayIns.error) throw dayIns.error;

    if (!day.exercises.length) continue;
    const { error } = await supabase.from('programme_exercises').insert(
      day.exercises.map((x) => ({
        client_id: clientId,
        day_id: dayIns.data.id,
        exercise_id: x.exerciseId,
        name: x.name,
        target_sets: x.sets,
        target_reps: `${x.repMin}-${x.repMax}`,
        target_rir: x.rir,
        rest_seconds: x.restSeconds,
        movement_pattern: x.pattern,
        notes: x.role === 'main' ? 'Main lift' : null,
        sort_order: x.sort ?? 0,
      })),
    );
    if (error) throw error;
  }

  return programmeId;
}
