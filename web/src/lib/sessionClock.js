// Count time while running, including browser suspension, never the age of a database record.
const MAX_MS = 7 * 86400000;
const MAX_RECOVERY_GAP_MS = 12 * 3600000;
const safeMs = (value) => Number.isFinite(value) && value >= 0 && value <= MAX_MS ? value : 0;
export const formatSessionTime = (seconds) => {
  const total = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(total / 60);
  const tail = String(total % 60).padStart(2, '0');
  return minutes >= 60 ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}:${tail}` : `${minutes}:${tail}`;
};
export function restoreClock(saved, serverSeconds = 0, now = 0) {
  const snapshot = [1, 2].includes(saved?.version) ? saved : {};
  const gap = now - snapshot.savedAt;
  // Recover a running workout after a mobile browser reload. Old/legacy sessions
  // require Resume so an abandoned workout cannot accumulate days of duration.
  const running = snapshot.version === 2 && snapshot.paused === false && Number.isFinite(snapshot.savedAt) && gap >= 0 && gap <= MAX_RECOVERY_GAP_MS;
  const active = running ? gap : 0;
  return { elapsedMs: Math.max(safeMs(snapshot.elapsedMs) + active, safeMs(serverSeconds * 1000)),
    restMs: Math.max(0, safeMs(snapshot.restMs) - active), paused: !running, lastAt: now, restEnded: false, interrupted: false };
}
export function stepClock(clock, now) {
  const delta = Math.max(0, now - clock.lastAt);
  const active = clock.paused ? 0 : delta;
  return { ...clock, lastAt: Math.max(clock.lastAt, now), elapsedMs: clock.elapsedMs + active,
    restMs: Math.max(0, clock.restMs - active), restEnded: clock.restMs > 0 && clock.restMs <= active };
}
export function resumeClock(clock, now) {
  return { ...clock, paused: false, lastAt: now, restEnded: false, interrupted: false };
}
export function pauseClock(clock, now) {
  return { ...stepClock(clock, now), paused: true, restEnded: false };
}
export function clockSnapshot(clock, recovery) {
  return { version: 2, elapsedMs: clock.elapsedMs, restMs: clock.restMs, paused: clock.paused, savedAt: clock.lastAt, recovery };
}
