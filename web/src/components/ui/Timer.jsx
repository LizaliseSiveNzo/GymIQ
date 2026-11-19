import { useEffect, useRef, useState } from 'react';
import './timer.css';

function fmt(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const PRESETS = [30, 60, 120, 180, 300];

export default function Timer({ onClose }) {
  const [mode, setMode] = useState('stopwatch'); // 'stopwatch' | 'countdown'
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [remainingSec, setRemainingSec] = useState(60);
  const [target, setTarget] = useState(60);
  const startRef = useRef(0);
  const baseRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (mode === 'stopwatch') {
        setElapsedMs(baseRef.current + (Date.now() - startRef.current));
      } else {
        const left = Math.max(0, Math.ceil((baseRef.current - (Date.now() - startRef.current)) / 1000));
        setRemainingSec(left);
        if (left <= 0) {
          setRunning(false);
          if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 300]);
        }
      }
    }, 100);
    return () => clearInterval(id);
  }, [running, mode]);

  function start() {
    startRef.current = Date.now();
    if (mode === 'stopwatch') baseRef.current = elapsedMs;
    else baseRef.current = remainingSec * 1000;
    setRunning(true);
  }
  function pause() {
    if (mode === 'stopwatch') setElapsedMs(baseRef.current + (Date.now() - startRef.current));
    else setRemainingSec(Math.max(0, Math.ceil((baseRef.current - (Date.now() - startRef.current)) / 1000)));
    setRunning(false);
  }
  function reset() {
    setRunning(false);
    if (mode === 'stopwatch') { baseRef.current = 0; setElapsedMs(0); }
    else setRemainingSec(target);
  }
  function switchMode(m) {
    setRunning(false);
    setMode(m);
    if (m === 'stopwatch') { baseRef.current = 0; setElapsedMs(0); }
    else setRemainingSec(target);
  }
  function choosePreset(s) { setTarget(s); setRemainingSec(s); setRunning(false); }

  const display = mode === 'stopwatch' ? fmt(Math.floor(elapsedMs / 1000)) : fmt(remainingSec);

  return (
    <div className="timer-overlay" role="dialog" aria-modal="true" aria-label="Timer" onClick={onClose}>
      <div className="timer-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="timer-tabs">
          <button type="button" className={mode === 'stopwatch' ? 'on' : ''} onClick={() => switchMode('stopwatch')}>Stopwatch</button>
          <button type="button" className={mode === 'countdown' ? 'on' : ''} onClick={() => switchMode('countdown')}>Countdown</button>
        </div>
        <div className="timer-display">{display}</div>
        {mode === 'countdown' && !running && (
          <div className="timer-presets">
            {PRESETS.map((s) => (
              <button type="button" key={s} className={target === s ? 'on' : ''} onClick={() => choosePreset(s)}>
                {s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${s % 60 ? ' ' + (s % 60) + 's' : ''}`}
              </button>
            ))}
          </div>
        )}
        <div className="timer-actions">
          {running
            ? <button type="button" className="btn btn-secondary" onClick={pause}>Pause</button>
            : <button type="button" className="btn btn-primary" onClick={start}>Start</button>}
          <button type="button" className="btn btn-ghost" onClick={reset}>Reset</button>
        </div>
        <button type="button" className="timer-close" onClick={onClose} aria-label="Close timer">✕</button>
      </div>
    </div>
  );
}
