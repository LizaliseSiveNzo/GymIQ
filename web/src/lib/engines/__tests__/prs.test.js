/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { describe, it, expect } from 'vitest';
import { e1rm, topVolume, detectPRs } from '../prs.js';

describe('e1rm (Epley)', () => {
  it('computes the classic formula', () => {
    expect(e1rm(100, 1)).toBe(103.33);
    expect(e1rm(80, 5)).toBeCloseTo(93.33, 1);
    expect(e1rm(60, 10)).toBe(80);
  });
  it('returns 0 for incomplete input', () => {
    expect(e1rm(null, 5)).toBe(0);
    expect(e1rm(80, 0)).toBe(0);
  });
});

describe('topVolume', () => {
  it('multiplies weight × reps incl. left side', () => {
    expect(topVolume(20, 8, 20, 8)).toBe(320);
    expect(topVolume(60, 10)).toBe(600);
  });
});

describe('detectPRs', () => {
  const prior = { 'Bench Press': { e1rm: 90, volume: 800 } };

  it('flags a new e1RM and a new volume record independently', () => {
    const sets = [
      { exerciseName: 'Bench Press', weight: 85, reps: 3 },     // e1RM 93.5 → PR
      { exerciseName: 'Bench Press', weight: 70, reps: 12 },    // vol 840 → PR
    ];
    const { prs } = detectPRs(sets, prior);
    expect(prs.map((p) => p.type).sort()).toEqual(['e1rm', 'volume']);
  });

  it('stays quiet when nothing is beaten', () => {
    const { prs } = detectPRs([{ exerciseName: 'Bench Press', weight: 60, reps: 8 }], prior);
    expect(prs).toEqual([]);
  });

  it('first-ever exercise gets both records', () => {
    const { prs, next } = detectPRs([{ exerciseName: 'Squat', weight: 100, reps: 5 }], {});
    expect(prs).toHaveLength(2);
    expect(next.Squat.e1rm).toBe(e1rm(100, 5));
  });

  it('ignores zero-weight junk rows', () => {
    const { prs } = detectPRs([{ exerciseName: 'Plank', weight: 0, reps: 0 }], {});
    expect(prs).toEqual([]);
  });
});
