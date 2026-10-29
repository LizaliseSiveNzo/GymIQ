import { useCallback, useEffect, useRef, useState } from 'react';
import { clockSnapshot, pauseClock, restoreClock, resumeClock, stepClock } from '../lib/sessionClock.js';

export default function useSessionTimer(callbacks) {
  const latest = useRef(callbacks);
  latest.current = callbacks;
  const current = useRef(restoreClock(null));
  const storageKey = useRef(null);
  const lastSync = useRef(0);
  const [clock, setClock] = useState(current.current);
  const [storageError, setStorageError] = useState(false);
  const persist = useCallback(() => {
    if (!storageKey.current) return;
    try {
      localStorage.setItem(storageKey.current, JSON.stringify(clockSnapshot(current.current, latest.current.getRecovery?.())));
      setStorageError(false);
    } catch { setStorageError(true); }
  }, []);
  const sync = useCallback(() => {
    if (storageKey.current) latest.current.onCheckpoint?.(Math.floor(current.current.elapsedMs / 1000));
  }, []);
  const publish = useCallback((next) => {
    current.current = next;
    setClock(next);
    persist();
    if (next.restEnded) latest.current.onRestEnd?.();
  }, [persist]);
  const pause = useCallback(() => {
    publish(pauseClock(current.current, performance.now()));
    sync();
  }, [publish, sync]);
  const resume = useCallback(() => {
    if (document.visibilityState === 'hidden') return;
    publish(resumeClock(current.current, performance.now()));
  }, [publish]);
  const initialize = useCallback(({ key, serverSeconds, startFresh }) => {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(key)); } catch { /* cloud time remains available */ }
    storageKey.current = key;
    const restored = restoreClock(saved, serverSeconds, performance.now());
    current.current = startFresh && !saved && document.visibilityState !== 'hidden' ? resumeClock(restored, performance.now()) : restored;
    lastSync.current = current.current.elapsedMs;
    setClock(current.current);
    // Caller restores the drafts before the first persistence tick.
    return saved?.version === 1 ? saved.recovery : null;
  }, []);
  const changeRest = useCallback((seconds) => {
    const next = stepClock(current.current, performance.now());
    publish({ ...next, restMs: Math.max(0, seconds) * 1000, restEnded: false });
  }, [publish]);
  const addRest = useCallback((seconds) => {
    const next = stepClock(current.current, performance.now());
    publish({ ...next, restMs: Math.max(0, next.restMs + seconds * 1000), restEnded: false });
  }, [publish]);
  const complete = useCallback(() => {
    const key = storageKey.current;
    storageKey.current = null;
    current.current = pauseClock(current.current, performance.now());
    setClock(current.current);
    try { if (key) localStorage.removeItem(key); } catch { /* finished log is authoritative */ }
  }, []);
  useEffect(() => {
    const tick = setInterval(() => {
      if (!storageKey.current || current.current.paused) return;
      const next = stepClock(current.current, performance.now());
      publish(next);
      if (next.paused || next.elapsedMs - lastSync.current >= 15000) {
        lastSync.current = next.elapsedMs;
        sync();
      }
    }, 500);
    const hide = () => { if (document.visibilityState === 'hidden') pause(); };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', pause);
    window.addEventListener('online', sync);
    return () => {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', pause);
      window.removeEventListener('online', sync);
      // Route changes also pause and save; no timer continues off this page.
      current.current = pauseClock(current.current, performance.now());
      persist();
      sync();
    };
  }, [pause, persist, publish, sync]);
  return { clock, storageError, initialize, pause, resume, changeRest, addRest, complete,
    saveRecovery: persist, isPaused: () => current.current.paused,
    getSeconds: () => Math.floor(stepClock(current.current, performance.now()).elapsedMs / 1000) };
}
