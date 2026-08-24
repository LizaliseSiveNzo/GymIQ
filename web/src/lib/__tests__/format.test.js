/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { describe, it, expect } from 'vitest';
import { initials, isToday, startOfToday, endOfWeek } from '../format.js';

describe('initials', () => {
  it('takes first letters of the first two words, uppercased', () => {
    expect(initials('lizalise nzo')).toBe('LN');
    expect(initials('one')).toBe('O');
    expect(initials('')).toBe('');
  });
});

describe('isToday', () => {
  it('is true for right now', () => {
    expect(isToday(new Date().toISOString())).toBe(true);
  });
  it('is false for an old date', () => {
    expect(isToday('2001-01-01T00:00:00Z')).toBe(false);
  });
  it('is false for falsy input', () => {
    expect(isToday(null)).toBe(false);
    expect(isToday('')).toBe(false);
  });
});

describe('startOfToday / endOfWeek', () => {
  it('startOfToday is midnight local', () => {
    const s = startOfToday();
    expect([s.getHours(), s.getMinutes(), s.getSeconds(), s.getMilliseconds()]).toEqual([0, 0, 0, 0]);
  });
  it('endOfWeek lands on a Sunday at/after startOfToday', () => {
    const s = startOfToday();
    const e = endOfWeek();
    expect(e.getDay()).toBe(0); // Sunday
    expect(e.getTime()).toBeGreaterThanOrEqual(s.getTime());
  });
});
