/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

// Volume landmarks: hard sets per muscle per week (fractional credits count).
// Evidence-informed baselines (MEV/MAV/MRV thinking from the hypertrophy
// literature). These are OUR constants — tunable here, auditable in git.

export const LANDMARKS = {
  chest:       { mev: 8,  mav: 13, mrv: 20 },
  front_delts: { mev: 4,  mav: 8,  mrv: 14 },
  side_delts:  { mev: 4,  mav: 10, mrv: 16 },
  rear_delts:  { mev: 3,  mav: 7,  mrv: 13 },
  biceps:      { mev: 6,  mav: 11, mrv: 18 },
  triceps:     { mev: 6,  mav: 11, mrv: 17 },
  forearms:    { mev: 2,  mav: 4,  mrv: 8 },
  upper_back:  { mev: 6,  mav: 11, mrv: 18 },
  lats:        { mev: 8,  mav: 13, mrv: 20 },
  traps:       { mev: 3,  mav: 7,  mrv: 12 },
  abs:         { mev: 4,  mav: 8,  mrv: 14 },
  obliques:    { mev: 2,  mav: 4,  mrv: 8 },
  lower_back:  { mev: 2,  mav: 4,  mrv: 7 },
  glutes:      { mev: 4,  mav: 9,  mrv: 15 },
  quads:       { mev: 6,  mav: 11, mrv: 17 },
  hamstrings:  { mev: 5,  mav: 9,  mrv: 14 },
  adductors:   { mev: 2,  mav: 4,  mrv: 8 },
  abductors:   { mev: 2,  mav: 4,  mrv: 8 },
  calves:      { mev: 6,  mav: 9,  mrv: 14 },
  neck:        { mev: 2,  mav: 3,  mrv: 6 },
};

// Experience scales target volume around MAV.
export const EXPERIENCE_VOLUME_MULT = {
  novice: 0.7,
  intermediate: 1.0,
  advanced: 1.15,
};

/** Weekly hard-set TARGET per muscle for this user's inputs. */
export function weeklyVolumeTargets({ experience = 'intermediate', focus = [], deprioritized = [] }) {
  const mult = EXPERIENCE_VOLUME_MULT[experience] ?? 1.0;
  const targets = {};
  for (const [id, lm] of Object.entries(LANDMARKS)) {
    let t = lm.mav * mult;
    if (deprioritized.includes(id)) t = Math.max(lm.mev * Math.min(mult, 1), lm.mev);
    else if (focus.includes(id)) t = Math.min(lm.mrv - 2, lm.mav * mult + 3);
    targets[id] = Math.round(t);
  }
  return targets;
}

/**
 * Fractional credit a set of an exercise gives each muscle.
 * Primary = 1.0; secondaries per stored fraction.
 */
export function muscleCredits(exercise) {
  const out = {};
  if (exercise?.primary_muscle_id) out[exercise.primary_muscle_id] = 1.0;
  const sec = typeof exercise?.secondary_muscle_fraction === 'string'
    ? JSON.parse(exercise.secondary_muscle_fraction || '{}')
    : (exercise?.secondary_muscle_fraction || {});
  for (const [m, f] of Object.entries(sec)) out[m] = Math.max(out[m] || 0, Number(f) || 0);
  return out;
}
