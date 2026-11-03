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
    publish(pauseClock(current.current, Date.now()));
    sync();
  }, [publish, sync]);
  const resume = useCallback(() => {
    if (document.visibilityState === 'hidden') return;
    publish(resumeClock(current.current, Date.now()));
  }, [publish]);
  const initialize = useCallback(({ key, serverSeconds, startFresh }) => {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(key)); } catch { /* cloud time remains available */ }
    storageKey.current = key;
    const restored = restoreClock(saved, serverSeconds, Date.now());
    current.current = startFresh && !saved && document.visibilityState !== 'hidden' ? resumeClock(restored, Date.now()) : restored;
    lastSync.current = current.current.elapsedMs;
    setClock(current.current);
    // Caller restores the drafts before the first persistence tick.
    return [1, 2].includes(saved?.version) ? saved.recovery : null;
  }, []);
  const changeRest = useCallback((seconds) => {
    const next = stepClock(current.current, Date.now());
    publish({ ...next, restMs: Math.max(0, seconds) * 1000, restEnded: false });
  }, [publish]);
  const addRest = useCallback((seconds) => {
    const next = stepClock(current.current, Date.now());
    publish({ ...next, restMs: Math.max(0, next.restMs + seconds * 1000), restEnded: false });
  }, [publish]);
  const complete = useCallback(() => {
    const key = storageKey.current;
    storageKey.current = null;
    current.current = pauseClock(current.current, Date.now());
    setClock(current.current);
    try { if (key) localStorage.removeItem(key); } catch { /* finished log is authoritative */ }
  }, []);
  useEffect(() => {
    const tick = setInterval(() => {
      if (!storageKey.current || current.current.paused) return;
      const next = stepClock(current.current, Date.now());
      publish(next);
      if (next.paused || next.elapsedMs - lastSync.current >= 15000) {
        lastSync.current = next.elapsedMs;
        sync();
      }
    }, 500);
    // Save on backgrounding, but keep the clock running across browser suspension.
    const checkpoint = () => {
      if (!storageKey.current) return;
      publish(stepClock(current.current, Date.now()));
      sync();
    };
    document.addEventListener('visibilitychange', checkpoint);
    window.addEventListener('pagehide', checkpoint);
    window.addEventListener('pageshow', checkpoint);
    window.addEventListener('online', sync);
    return () => {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', checkpoint);
      window.removeEventListener('pagehide', checkpoint);
      window.removeEventListener('pageshow', checkpoint);
      window.removeEventListener('online', sync);
      // Navigating out of the workout still pauses; backgrounding the app does not.
      current.current = pauseClock(current.current, Date.now());
      persist();
      sync();
    };
  }, [persist, publish, sync]);
  return { clock, storageError, initialize, pause, resume, changeRest, addRest, complete,
    saveRecovery: persist, isPaused: () => current.current.paused,
    getSeconds: () => Math.floor(stepClock(current.current, Date.now()).elapsedMs / 1000) };
}
