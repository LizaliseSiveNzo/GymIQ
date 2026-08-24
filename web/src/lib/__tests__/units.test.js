/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { describe, it, expect } from 'vitest';
import { kgToLb, lbToKg, cmToIn, fromKg, toKg, formatWeight, formatHeight, weightUnit, round1 } from '../units.js';

describe('conversions', () => {
  it('kg <-> lb round-trips', () => {
    expect(round1(kgToLb(100))).toBe(220.5);
    expect(round1(lbToKg(45))).toBe(20.4);
    expect(round1(lbToKg(kgToLb(50)))).toBe(50);
  });
  it('cm -> in', () => {
    expect(round1(cmToIn(180))).toBe(70.9);
  });
});

describe('storage helpers', () => {
  it('fromKg formats to the display unit', () => {
    expect(fromKg(22.5, 'metric')).toBe(22.5);
    expect(fromKg(20, 'imperial')).toBe(44.1);
  });
  it('toKg converts back to kg', () => {
    expect(round1(toKg(44.1, 'imperial'))).toBe(20);
    expect(toKg(30, 'metric')).toBe(30);
  });
});

describe('formatting', () => {
  it('formatWeight', () => {
    expect(formatWeight(22.5, 'metric')).toBe('22.5 kg');
    expect(formatWeight(20, 'imperial')).toBe('44.1 lb');
    expect(formatWeight(null)).toBe('—');
  });
  it('formatHeight', () => {
    expect(formatHeight(180, 'metric')).toBe('180 cm');
    expect(formatHeight(180, 'imperial')).toBe("5'11\"");
    expect(formatHeight(null)).toBe('—');
  });
  it('weightUnit', () => {
    expect(weightUnit('imperial')).toBe('lb');
    expect(weightUnit('metric')).toBe('kg');
  });
});
