import { describe, expect, it } from 'vitest';
import { clockSnapshot, formatSessionTime, pauseClock, restoreClock, resumeClock, stepClock } from '../sessionClock.js';

describe('active workout clock', () => {
  it('does not count time paused, and preserves the rest countdown on resume', () => {
    let clock = resumeClock({ ...restoreClock(null, 10, 0), restMs: 90000 }, 0);
    clock = pauseClock(clock, 12500);
    expect(clock.elapsedMs).toBe(22500);
    expect(clock.restMs).toBe(77500);
    clock = stepClock(clock, 86400000);
    expect(clock.elapsedMs).toBe(22500);
    clock = stepClock(resumeClock(clock, 86400000), 86402500);
    expect(clock.elapsedMs).toBe(25000);
    expect(clock.restMs).toBe(75000);
  });
  it('restores abandoned sessions paused without counting days away', () => {
    const active = stepClock(resumeClock(restoreClock(null, 0, 0), 0), 8000);
    const restored = restoreClock(clockSnapshot({ ...active, restMs: 42000 }, { activeIdx: 3 }), 5, 90000000);
    expect(restored.paused).toBe(true);
    expect(restored.elapsedMs).toBe(8000);
    expect(restored.restMs).toBe(42000);
  });
  it('counts suspended browser time and completes rest once without pausing', () => {
    const beforeSleep = { ...resumeClock(restoreClock(null, 65), 1000), restMs: 1000 };
    const restored = stepClock(beforeSleep, 3601000);
    expect(restored).toMatchObject({ paused: false, interrupted: false, elapsedMs: 3665000, restMs: 0, restEnded: true });
    expect(stepClock(restored, 3601500).restEnded).toBe(false);
  });
  it('recovers a running session after mobile process eviction with its rest countdown', () => {
    const active={...resumeClock(restoreClock(null, 60, 100000),100000),restMs:120000};
    const snapshot=clockSnapshot(active,{activeIdx:2});
    expect(restoreClock(snapshot,60,130000)).toMatchObject({paused:false,elapsedMs:90000,restMs:90000,lastAt:130000});
    expect(snapshot.recovery).toEqual({activeIdx:2});
    expect(restoreClock(snapshot,60,280000)).toMatchObject({paused:false,elapsedMs:240000,restMs:0});
  });
  it('keeps explicitly paused and legacy recovery snapshots paused', () => {
    const paused=pauseClock(resumeClock(restoreClock(null,60,100000),100000),105000);
    expect(restoreClock(clockSnapshot(paused),60,130000)).toMatchObject({paused:true,elapsedMs:65000});
    expect(restoreClock({version:1,elapsedMs:65000,restMs:1000},60,130000)).toMatchObject({paused:true,elapsedMs:65000,restMs:1000});
  });
  it('does not double count when the system clock briefly moves backwards', () => {
    const running=resumeClock(restoreClock(null),10000);
    const back=stepClock(running,9000);
    expect(stepClock(back,11000).elapsedMs).toBe(1000);
  });
  it('ends rest once, including delayed but valid ticks', () => {
    let clock = { ...resumeClock(restoreClock(null), 0), restMs: 1200 };
    clock = stepClock(clock, 1800);
    expect(clock).toMatchObject({ restMs: 0, restEnded: true, elapsedMs: 1800 });
    expect(stepClock(clock, 2800).restEnded).toBe(false);
    expect(pauseClock({ ...clock, restMs: 1000 }, 5000).restEnded).toBe(false);
  });
  it('uses the newer cloud checkpoint and rejects corrupt local values', () => {
    expect(restoreClock({ version: 1, elapsedMs: 1000, restMs: NaN }, 120).elapsedMs).toBe(120000);
    expect(restoreClock({ version: 1, elapsedMs: Infinity, restMs: -1 }, 0)).toMatchObject({ elapsedMs: 0, restMs: 0 });
    expect(restoreClock({ version: 0, elapsedMs: 999999999 }, 0).elapsedMs).toBe(0);
  });
  it('formats minute and hour boundaries without 0:60', () => {
    expect(formatSessionTime(59.9)).toBe('0:59');
    expect(formatSessionTime(60)).toBe('1:00');
    expect(formatSessionTime(3605)).toBe('1:00:05');
  });
});
