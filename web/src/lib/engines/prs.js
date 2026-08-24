/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

// PR detection + strength maths. Pure functions — unit-tested, no DB here.

/** Epley one-rep-max estimate, rounded to 2dp. */
export function e1rm(weight, reps) {
  const w = Number(weight), r = Number(reps);
  if (!w || !r) return 0;
  return Math.round(w * (1 + r / 30) * 100) / 100;
}

/** Top-set volume; counts both sides on unilateral lifts. */
export function topVolume(weightR, repsR, weightL = 0, repsL = 0) {
  const right = (Number(weightR) || 0) * (Number(repsR) || 0);
  const left = (Number(weightL) || 0) * (Number(repsL) || 0);
  return Math.round(right + left);
}

/**
 * Compare a finished session's sets against prior bests.
 * @param sets [{exerciseName, weight, reps, weightLeft?, repsLeft?}]
 * @param prior { [exerciseName]: { e1rm:number, volume:number } }
 * @returns {{ prs:[{exerciseName,type,value}], next: same shape as prior }}
 */
export function detectPRs(sets, prior = {}) {
  const next = JSON.parse(JSON.stringify(prior));
  const prs = [];

  // Best candidates per exercise within this session first.
  const sessionBest = {};
  for (const s of sets || []) {
    if (!s?.exerciseName) continue;
    const est = e1rm(s.weight, s.reps);
    const vol = topVolume(s.weight, s.reps, s.weightLeft, s.repsLeft);
    if (!est && !vol) continue;
    const b = (sessionBest[s.exerciseName] ||= { e1rm: 0, volume: 0 });
    b.e1rm = Math.max(b.e1rm, est);
    b.volume = Math.max(b.volume, vol);
  }

  for (const [name, b] of Object.entries(sessionBest)) {
    const prev = prior[name] || {};
    for (const type of ['e1rm', 'volume']) {
      const value = b[type];
      if (!value) continue;
      if (value > (prev[type] || 0)) {
        prs.push({ exerciseName: name, type, value });
        next[name] = next[name] || {};
        next[name][type] = value;
      }
    }
  }
  return { prs, next };
}

/**
 * Greedy plate math for one side of a barbell.
 * @returns number[] plates per side (descending)
 */
export function plateBreakdown(targetKg, barKg, denominationsKg = []) {
  let side = (Number(targetKg) - Number(barKg)) / 2;
  if (!isFinite(side) || side <= 0) return [];
  const plates = [...denominationsKg].sort((a, b) => b - a);
  const out = [];
  for (const p of plates) {
    while (side >= p - 1e-9) { out.push(p); side -= p; }
  }
  return out;
}
