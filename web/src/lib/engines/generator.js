/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { buildDays, autoSplit, slotBudget } from './templates.js';
import { weeklyVolumeTargets, muscleCredits } from './volumeLandmarks.rules.js';

// ─── Prescription schemes (sets × rep-range × RIR × rest) ────────────────────
// Transparent, auditable rules — deliberately NOT AI. Main = big compound
// pattern slots; accessories = muscle-picked isolation/secondary work.

const COMPOUND_PATTERNS = new Set([
  'squat', 'hinge', 'lunge',
  'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull',
]);

export const SCHEMES = {
  hypertrophy: { main: { sets: 3, repMin: 6,  repMax: 10, rir: 2, rest: 150 }, acc: { sets: 3, repMin: 10, repMax: 15, rir: 1, rest: 75 } },
  strength:    { main: { sets: 4, repMin: 3,  repMax: 6,  rir: 3, rest: 210 }, acc: { sets: 3, repMin: 8,  repMax: 12, rir: 2, rest: 90 } },
  both:        { main: { sets: 4, repMin: 5,  repMax: 8,  rir: 2, rest: 180 }, acc: { sets: 3, repMin: 10, repMax: 15, rir: 1, rest: 75 } },
};

const DIFFICULTY_CEILING = { novice: 2, intermediate: 3, advanced: 3 };

function equipmentOk(exercise, available) {
  const req = exercise.equipment_ids || [];
  if (!req.length) return true; // bodyweight
  return req.every((id) => available.has(id));
}

/** Score a candidate for a slot: prefer muscles furthest under their weekly target. */
function scoreCandidate(exercise, planned, targets) {
  const credits = muscleCredits(exercise);
  let score = 0;
  for (const [m, f] of Object.entries(credits)) {
    const deficit = (targets[m] ?? 8) - (planned[m] || 0);
    score += f * deficit;
  }
  return score;
}

/**
 * Build the program.
 * @param input {{goal:'hypertrophy'|'strength'|'both', daysPerWeek:number,
 *   sessionMinutes:number, split:string('auto'|…), experience:string,
 *   focus:string[], deprioritized:string[], equipmentIds:string[]|Set<string>,
 *   name?:string}}
 * @param catalog {{exercises:Array}} global exercise rows
 * @returns generated program tree + weeklySets summary
 */
export function generateProgram(input, catalog) {
  const exercises = catalog.exercises || [];
  if (!exercises.length) throw new Error('Exercise catalog is empty');

  const available = input.equipmentIds instanceof Set ? input.equipmentIds : new Set(input.equipmentIds || []);
  const split = !input.split || input.split === 'auto' ? autoSplit(input.daysPerWeek) : input.split;
  const daysTpl = buildDays(split, input.daysPerWeek);
  const cap = slotBudget(input.sessionMinutes);
  const scheme = SCHEMES[input.goal] || SCHEMES.hypertrophy;
  const targets = weeklyVolumeTargets(input);

  // Difficulty filter by experience; stability preference for novices.
  const maxDiff = DIFFICULTY_CEILING[input.experience] ?? 3;

  const used = new Set();
  const planned = {};            // muscle → fractional sets so far
  const credit = (ex, mult = 1) => {
    for (const [m, f] of Object.entries(muscleCredits(ex))) planned[m] = (planned[m] || 0) + f * mult;
  };

  function candidatesFor(slot) {
    let pool;
    if (slot.kind === 'pattern') {
      pool = exercises.filter((e) => e.movement_pattern === slot.pattern);
    } else {
      pool = exercises.filter((e) => e.primary_muscle_id === slot.muscle
        && !['cardio'].includes(e.movement_pattern || ''));
    }
    return pool.filter((e) => !used.has(e.id)
      && equipmentOk(e, available)
      && (e.difficulty ?? 2) <= maxDiff);
  }

  function pickBest(cands) {
    if (!cands.length) return null;
    const sorted = [...cands].sort((a, b) => {
      const s = scoreCandidate(b, planned, targets) - scoreCandidate(a, planned, targets);
      if (s !== 0) return s;
      // Tiebreaks: novices favor machine stability; then canonical order.
      if (input.experience === 'novice') {
        const stab = (a.stability_demand ?? 3) - (b.stability_demand ?? 3);
        if (stab !== 0) return stab;
      }
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
    return sorted[0];
  }

  const days = daysTpl.map((tpl, di) => {
    const picked = [];
    const seenPatternToday = {};
    tpl.slots.slice(0, cap).forEach((slot, si) => {
      const cands = candidatesFor(slot);
      const ex = pickBest(cands);
      if (!ex) return;
      used.add(ex.id);
      const isMain = slot.kind === 'pattern' && COMPOUND_PATTERNS.has(slot.pattern)
        && (seenPatternToday[slot.pattern] || 0) < 1
        && si < Math.max(3, cap - 2); // early slots carry the compounds
      seenPatternToday[slot.pattern] = (seenPatternToday[slot.pattern] || 0) + 1;
      const p = isMain ? scheme.main : scheme.acc;
      const secFrac = typeof ex.secondary_muscle_fraction === 'string'
        ? JSON.parse(ex.secondary_muscle_fraction || '{}')
        : (ex.secondary_muscle_fraction || {});
      credit(ex, p.sets);
      picked.push({
        exerciseId: ex.id,
        name: ex.name,
        pattern: ex.movement_pattern,
        primaryMuscle: ex.primary_muscle_id,
        secondaryFractions: secFrac,
        role: isMain ? 'main' : 'accessory',
        sets: p.sets, repMin: p.repMin, repMax: p.repMax, rir: p.rir, restSeconds: p.rest,
        sort: picked.length,
      });
    });

    // Top-up: pattern/muscle slots get skipped when the available equipment has
    // no valid candidate (or the catalog was exhausted by dedup). Fill the day to
    // its time budget with the best unused accessory (isolation/core) for the
    // muscles furthest under target — so sessions stay full instead of short.
    while (picked.length < cap) {
      const accPool = exercises.filter((e) => !used.has(e.id)
        && equipmentOk(e, available)
        && (e.difficulty ?? 2) <= maxDiff
        && ['isolation', 'core'].includes(e.movement_pattern || ''));
      const ex = pickBest(accPool);
      if (!ex) break;
      used.add(ex.id);
      const p = scheme.acc;
      const secFrac = typeof ex.secondary_muscle_fraction === 'string'
        ? JSON.parse(ex.secondary_muscle_fraction || '{}')
        : (ex.secondary_muscle_fraction || {});
      credit(ex, p.sets);
      picked.push({
        exerciseId: ex.id, name: ex.name, pattern: ex.movement_pattern,
        primaryMuscle: ex.primary_muscle_id, secondaryFractions: secFrac,
        role: 'accessory', sets: p.sets, repMin: p.repMin, repMax: p.repMax,
        rir: p.rir, restSeconds: p.rest, sort: picked.length,
      });
    }

    return {
      label: tpl.label,
      name: tpl.name,
      focusSummary: [...new Set(picked.map((p) => p.primaryMuscle).filter(Boolean))]
        .slice(0, 4),
      exercises: picked,
      dayIndex: di,
    };
  });

  reconcileVolume(days, targets);

  return {
    name: input.name || `${cap}-slot ${split} program`,
    split,
    goal: input.goal,
    daysPerWeek: input.daysPerWeek,
    sessionMinutes: input.sessionMinutes,
    deloadPolicy: input.deloadPolicy || 'auto',
    weeks: buildWeeks(input.deloadPolicy || 'auto'),
    days,
    weeklySets: summarizeWeekly(days),
    volumeTargets: targets,
  };
}

/** Add/trim accessory sets to pull weekly per-muscle totals toward targets. */
function reconcileVolume(days, targets) {
  const totals = () => summarizeWeekly(days);
  for (let pass = 0; pass < 4; pass++) {
    const t = totals();
    // Over MRV anywhere? Trim one set from an accessory crediting it most.
    const over = Object.keys(t).filter((m) => (targets[m] ? t[m] > targets[m] * 1.25 : false));
    if (over.length) {
      outerTrim: for (const day of [...days].reverse()) {
        for (const ex of [...day.exercises].reverse()) {
          if (ex.role !== 'accessory' || ex.sets <= 2) continue;
          if (over.some((m) => m === ex.primaryMuscle)) { ex.sets -= 1; break outerTrim; }
        }
      }
      continue;
    }
    // Under MEV somewhere addable? Add one set to a matching accessory.
    const under = Object.keys(targets).find((m) => t[m] < targets[m] * 0.7);
    if (!under) break;
    outerAdd: for (const day of days) {
      for (const ex of day.exercises) {
        if (ex.role !== 'accessory' || ex.sets >= 5) continue;
        const creds = muscleCredits({ primary_muscle_id: ex.primaryMuscle, secondary_muscle_fraction: {} });
        if (creds[under]) { ex.sets += 1; break outerAdd; }
      }
    }
  }
}

export function summarizeWeekly(days) {
  const t = {};
  for (const d of days) for (const ex of d.exercises) {
    const credits = muscleCredits({
      primary_muscle_id: ex.primaryMuscle,
      secondary_muscle_fraction: ex.secondaryFractions || {},
    });
    for (const [m, f] of Object.entries(credits)) t[m] = (t[m] || 0) + f * ex.sets;
  }
  return t;
}

/**
 * Periodization horizon: 8 weeks of week records.
 * auto → lighter week at wk 5 · every_4w → wks 4 & 8 · every_6w → wk 6 · never → none.
 */
export function buildWeeks(policy) {
  const weeks = [];
  const HORIZON = 8;
  const deloadAt = policy === 'every_4w' ? [4, 8]
    : policy === 'every_6w' ? [6]
    : policy === 'auto' ? [5]
    : [];
  for (let w = 1; w <= HORIZON; w++) {
    const isDeload = deloadAt.includes(w);
    weeks.push({
      weekNumber: w,
      kind: isDeload ? 'deload' : 'accumulate',
      volumeMultiplier: isDeload ? 0.5 : 1.0,
    });
  }
  return weeks;
}
