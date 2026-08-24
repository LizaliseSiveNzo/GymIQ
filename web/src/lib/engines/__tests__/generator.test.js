/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { describe, it, expect } from 'vitest';
import { generateProgram, buildWeeks } from '../generator.js';

// Synthetic mini-catalog: enough coverage per pattern/muscle to exercise the
// selection rules deterministically. ids are stable strings.
let n = 0;
const ex = (name, primary, pattern, equipment, opts = {}) => ({
  id: `x${++n}`,
  name,
  primary_muscle_id: primary,
  secondary_muscle_fraction: opts.sec || {},
  movement_pattern: pattern,
  laterality: 'bilateral',
  stability_demand: opts.stab ?? 3,
  equipment_ids: equipment,
  is_weighted: !equipment.includes('bodyweight'),
  difficulty: opts.diff ?? 2,
  sort_order: opts.sort ?? n,
});

const CATALOG = {
  exercises: [
    // horizontal push
    ex('Barbell Bench', 'chest', 'horizontal_push', ['barbell', 'flat_bench'], { sec: { front_delts: .5, triceps: .4 } }),
    ex('DB Bench', 'chest', 'horizontal_push', ['dumbbells', 'flat_bench'], { sec: { front_delts: .5, triceps: .5 } }),
    ex('Machine Press', 'chest', 'horizontal_push', ['chest_press_machine'], { sec: { front_delts: .5 }, diff: 1, stab: 1 }),
    ex('Push-Up', 'chest', 'horizontal_push', ['bodyweight']),
    // vertical push
    ex('OHP', 'front_delts', 'vertical_push', ['barbell'], { sec: { side_delts: .5 }, diff: 3 }),
    ex('DB Shoulder Press', 'front_delts', 'vertical_push', ['dumbbells'], { sec: { side_delts: .5 } }),
    ex('Machine Shoulder Press', 'front_delts', 'vertical_push', ['shoulder_press_machine'], { sec: { side_delts: .5 }, diff: 1, stab: 1 }),
    // horizontal pull
    ex('Barbell Row', 'lats', 'horizontal_pull', ['barbell'], { sec: { upper_back: .5 } }),
    ex('Cable Row', 'upper_back', 'horizontal_pull', ['cable_machine'], { sec: { lats: .5 }, diff: 1, stab: 2 }),
    ex('DB Row', 'lats', 'horizontal_pull', ['dumbbells'], { sec: { upper_back: .5 } }),
    // vertical pull
    ex('Pulldown', 'lats', 'vertical_pull', ['lat_pulldown'], { sec: { biceps: .5 }, diff: 1, stab: 2 }),
    ex('Pull-Up', 'lats', 'vertical_pull', ['pull_up_bar'], { diff: 3 }),
    // squat
    ex('Back Squat', 'quads', 'squat', ['barbell', 'squat_rack'], { sec: { glutes: .5 }, diff: 3 }),
    ex('Goblet Squat', 'quads', 'squat', ['kettlebell'], { diff: 1, stab: 2 }),
    ex('Leg Press', 'quads', 'squat', ['leg_press'], { sec: { glutes: .4 }, diff: 1, stab: 1 }),
    // hinge
    ex('Deadlift', 'hamstrings', 'hinge', ['barbell'], { sec: { lower_back: .4, glutes: .4 }, diff: 3 }),
    ex('RDL', 'hamstrings', 'hinge', ['dumbbells'], { sec: { glutes: .5 } }),
    ex('Seated Leg Curl', 'hamstrings', 'hinge', ['leg_curl_machine'], { diff: 1, stab: 1 }),
    // lunge
    ex('Walking Lunge', 'glutes', 'lunge', ['dumbbells'], { sec: { quads: .5 } }),
    ex('Split Squat', 'quads', 'lunge', ['bodyweight']),
    // isolation by primary muscle
    ex('Curl', 'biceps', 'isolation', ['dumbbells']),
    ex('Preacher Curl', 'biceps', 'isolation', ['preacher_bench', 'ez_bar']),
    ex('Pushdown', 'triceps', 'isolation', ['cable_machine', 'rope_attachment']),
    ex('Skullcrusher', 'triceps', 'isolation', ['ez_bar', 'flat_bench']),
    ex('Lateral Raise', 'side_delts', 'isolation', ['dumbbells']),
    ex('Rear Delt Fly', 'rear_delts', 'isolation', ['dumbbells']),
    ex('Leg Extension', 'quads', 'isolation', ['leg_extension_machine']),
    ex('Calf Raise', 'calves', 'isolation', ['standing_calf_machine']),
    ex('Plank', 'abs', 'core', ['mat']),
    ex('Crunch', 'abs', 'core', ['bodyweight']),
  ],
};

const BASE = {
  goal: 'hypertrophy', daysPerWeek: 3, sessionMinutes: 60, split: 'auto',
  experience: 'intermediate', focus: [], deprioritized: [],
  equipmentIds: ['barbell', 'flat_bench', 'dumbbells', 'lat_pulldown', 'cable_machine',
    'pull_up_bar', 'kettlebell', 'mat'],
};

describe('generateProgram', () => {
  it('builds the requested number of non-empty days', () => {
    const p = generateProgram(BASE, CATALOG);
    expect(p.days).toHaveLength(3);
    for (const d of p.days) expect(d.exercises.length).toBeGreaterThanOrEqual(4);
  });

  it('never repeats an exercise across the whole program', () => {
    const p = generateProgram({ ...BASE, daysPerWeek: 6 }, CATALOG);
    const ids = p.days.flatMap((d) => d.exercises.map((e) => e.exerciseId));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only uses exercises the available equipment can load', () => {
    const home = generateProgram({ ...BASE, equipmentIds: ['dumbbells', 'flat_bench', 'mat'] }, CATALOG);
    const allowed = new Set(['dumbbells', 'flat_bench', 'mat']);
    for (const d of home.days) for (const e of d.exercises) {
      const row = CATALOG.exercises.find((c) => c.id === e.exerciseId);
      for (const req of row.equipment_ids) expect(allowed.has(req)).toBe(true);
    }
  });

  it('respects novice difficulty ceiling and prefers stable machines', () => {
    // Machine must be available for the novice-stability preference to apply.
    const p = generateProgram({ ...BASE, experience: 'novice', equipmentIds: [...BASE.equipmentIds, 'shoulder_press_machine'] }, CATALOG);
    for (const d of p.days) for (const e of d.exercises) {
      const row = CATALOG.exercises.find((c) => c.id === e.exerciseId);
      expect(row.difficulty).toBeLessThanOrEqual(2);
      if (row.movement_pattern === 'vertical_push') {
        expect(row.equipment_ids).toContain('shoulder_press_machine'); // not OHP (diff 3)
      }
    }
  });

  it('gives strength mains a lower rep ceiling than hypertrophy mains', () => {
    const hyp = generateProgram(BASE, CATALOG);
    const str = generateProgram({ ...BASE, goal: 'strength' }, CATALOG);
    const mainMax = (p) => Math.max(...p.days.flatMap((d) =>
      d.exercises.filter((e) => e.role === 'main').map((e) => e.repMax)));
    expect(mainMax(str)).toBeLessThan(mainMax(hyp));
  });

  it('auto-resolves split by availability', () => {
    expect(generateProgram({ ...BASE, daysPerWeek: 2 }, CATALOG).split).toBe('full_body');
    expect(generateProgram({ ...BASE, daysPerWeek: 4 }, CATALOG).split).toBe('upper_lower');
    expect(generateProgram({ ...BASE, daysPerWeek: 5 }, CATALOG).split).toBe('ppl');
  });

  it('focus muscles out-earn deprioritized ones', () => {
    const p = generateProgram({ ...BASE, focus: ['chest'], deprioritized: ['calves'] }, CATALOG);
    expect(p.weeklySets.chest).toBeGreaterThan(p.weeklySets.calves ?? 0);
  });

  it('every main lift carries an RIR target and rest period', () => {
    const p = generateProgram(BASE, CATALOG);
    for (const d of p.days) for (const e of d.exercises) {
      expect(e.rir).toBeGreaterThanOrEqual(0);
      expect(e.restSeconds).toBeGreaterThan(0);
    }
  });
});

describe('buildWeeks', () => {
  it('places deloads per policy inside the horizon', () => {
    expect(buildWeeks('never').every((w) => w.kind === 'accumulate')).toBe(true);
    const w4 = buildWeeks('every_4w').filter((w) => w.kind === 'deload');
    expect(w4.map((w) => w.weekNumber)).toEqual([4, 8]);
    const auto = buildWeeks('auto').find((w) => w.kind === 'deload');
    expect(auto.weekNumber).toBe(5);
    expect(auto.volumeMultiplier).toBeLessThan(1);
  });
});
