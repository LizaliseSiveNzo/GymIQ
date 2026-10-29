// Count observed active time, never the age of a database record.
const MAX_MS = 7 * 86400000;
const safeMs = (value) => Number.isFinite(value) && value >= 0 && value <= MAX_MS ? value : 0;
export const formatSessionTime = (seconds) => {
  const total = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(total / 60);
  const tail = String(total % 60).padStart(2, '0');
  return minutes >= 60 ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}:${tail}` : `${minutes}:${tail}`;
};
export function restoreClock(saved, serverSeconds = 0, now = 0) {
  const snapshot = saved?.version === 1 ? saved : {};
  return { elapsedMs: Math.max(safeMs(snapshot.elapsedMs), safeMs(serverSeconds * 1000)),
    restMs: safeMs(snapshot.restMs), paused: true, lastAt: now, restEnded: false, interrupted: false };
}
export function stepClock(clock, now) {
  const delta = Math.max(0, now - clock.lastAt);
  // A suspended browser, sleeping device or frozen process is not active training.
  if (!clock.paused && delta > 30000) return { ...clock, paused: true, lastAt: now, restEnded: false, interrupted: true };
  const active = clock.paused ? 0 : delta;
  return { ...clock, lastAt: now, elapsedMs: clock.elapsedMs + active,
    restMs: Math.max(0, clock.restMs - active), restEnded: clock.restMs > 0 && clock.restMs <= active };
}
export function resumeClock(clock, now) {
  return { ...clock, paused: false, lastAt: now, restEnded: false, interrupted: false };
}
export function pauseClock(clock, now) {
  return { ...stepClock(clock, now), paused: true, restEnded: false };
}
export function clockSnapshot(clock, recovery) {
  return { version: 1, elapsedMs: clock.elapsedMs, restMs: clock.restMs, recovery };
}
