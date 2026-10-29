import { describe, expect, it, vi } from 'vitest';
import { createRestBell } from '../restBell.js';

function fixture() {
  const tones = [];
  const context = { state: 'running', currentTime: 10, destination: {}, resume: vi.fn(async () => { context.state = 'running'; }),
    suspend: vi.fn(async () => { context.state = 'suspended'; }), close: vi.fn(async () => { context.state = 'closed'; }),
    createOscillator: () => {
      const tone = { frequency: {}, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() };
      tones.push(tone); return tone;
    },
    createGain: () => ({ gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() }),
  };
  const environment = { AudioContext: function () { return context; }, navigator: { audioSession: { type: 'auto' } } };
  return { bell: createRestBell(environment), context, tones, environment };
}
describe('short rest bell', () => {
  it('schedules exactly two taps that finish in under one second and chooses ambient mixing', async () => {
    const { bell, tones, environment, context } = fixture();
    expect(await bell.play()).toBe(true);
    expect(tones).toHaveLength(6); // three quiet harmonics per tap
    expect(new Set(tones.map(t => t.start.mock.calls[0][0])).size).toBe(2);
    expect(Math.max(...tones.map(t => t.stop.mock.calls[0][0])) - context.currentTime).toBeLessThan(0.8);
    expect(environment.navigator.audioSession.type).toBe('ambient');
    tones.forEach(t => t.onended());
    expect(context.suspend).toHaveBeenCalledOnce();
  });
  it('does not sound while muted, and cancels scheduled taps when paused', async () => {
    const { bell, tones } = fixture();
    bell.setEnabled(false);
    expect(await bell.play()).toBe(false);
    expect(tones).toHaveLength(0);
    bell.setEnabled(true);
    await bell.play();
    bell.stop();
    expect(tones.every(t => t.stop.mock.calls.length === 2)).toBe(true);
  });
  it('does not replay a queued bell after pause, and handles unsupported audio', async () => {
    const { bell, tones } = fixture();
    const pending = bell.play();
    bell.stop();
    expect(await pending).toBe(false);
    expect(tones).toHaveLength(0);
    expect(await createRestBell({}).play()).toBe(false);
  });
});
