import { useEffect, useMemo, useRef, useState } from 'react';
import './timer.css';

const TICK_MS = 5000;                 // 5s per tick
const ROTATION_MS = 300000;           // 5 min per full rotation
const MAX_MS = 99 * 60 * 1000;        // 99 minutes
const STOPWATCH_ROTATION_MS = 60000;  // 60s per stopwatch rotation
const STORAGE_KEY = 'gymiq-timer-v1';

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function polar(cx, cy, r, deg) {
  const rad = deg * Math.PI / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}
function arcPath(cx, cy, r, deg) {
  const d = Math.max(0, Math.min(360, deg));
  if (d <= 0.001) return '';
  const s = polar(cx, cy, r, 0);
  const e = polar(cx, cy, r, d);
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${d > 180 ? 1 : 0} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}
function fmtMMSS(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
function fmtMMSSHH(ms) {
  const total = Math.max(0, ms);
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const h = Math.floor((total % 1000) / 10);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(h).padStart(2, '0')}`;
}
function parseTime(text) {
  const m = String(text || '').trim().match(/^(\d{1,2}):([0-5]\d)$/);
  if (!m) return null;
  const sec = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  return Math.max(0, Math.min(MAX_MS, sec * 1000));
}
function vibrate(pattern) { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch { /* unsupported */ } }
function playAlarm() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const gain = ctx.createGain();
    gain.connect(ctx.destination); gain.gain.value = 0.25;
    [0, 280, 560].forEach((t, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine'; osc.frequency.value = i % 2 ? 660 : 880;
      osc.connect(gain);
      osc.start(ctx.currentTime + t / 1000);
      osc.stop(ctx.currentTime + (t + 200) / 1000);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch { /* audio unavailable */ }
}

export default function Timer({ onClose }) {
  const [mode, setMode] = useState('timer');
  // stopwatch
  const [swRunning, setSwRunning] = useState(false);
  const [swAccum, setSwAccum] = useState(0);
  const [laps, setLaps] = useState([]);
  // timer
  const [totalMs, setTotalMs] = useState(0);
  const [tRunning, setTRunning] = useState(false);
  const [timesUp, setTimesUp] = useState(false);
  const [manual, setManual] = useState(false);
  const [manualText, setManualText] = useState('');

  const startRef = useRef(0);
  const startRemainingRef = useRef(0);
  const [now, setNow] = useState(Date.now());
  const dialRef = useRef(null);
  const dragRef = useRef(null);

  // Restore persisted state once.
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (raw) {
        setMode(raw.mode === 'stopwatch' ? 'stopwatch' : 'timer');
        setSwRunning(!!raw.swRunning); setSwAccum(raw.swAccum || 0); setLaps(raw.laps || []);
        setTotalMs(raw.totalMs || 0); setTRunning(!!raw.tRunning);
        startRef.current = raw.startAt || 0; startRemainingRef.current = raw.startRemaining || 0;
        setNow(Date.now());
      }
    } catch { /* ignore */ }
  }, []);

  // Persist state.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, swRunning, swAccum, laps, totalMs, tRunning, startAt: startRef.current, startRemaining: startRemainingRef.current }));
    } catch { /* ignore */ }
  }, [mode, swRunning, swAccum, laps, totalMs, tRunning]);

  const running = mode === 'stopwatch' ? swRunning : tRunning;

  // Accurate timestamp-based clock.
  useEffect(() => {
    if (!running) return;
    if (reducedMotion()) { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }
    let raf; const tick = () => { setNow(Date.now()); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [running]);

  const elapsedMs = swRunning ? swAccum + (now - startRef.current) : swAccum;
  const remainingMs = tRunning ? Math.max(0, startRemainingRef.current - (now - startRef.current)) : totalMs;

  // Alarm when the countdown reaches zero.
  useEffect(() => {
    if (mode === 'timer' && tRunning && remainingMs <= 0) {
      setTRunning(false); setTimesUp(true); setTotalMs(0);
      vibrate([220, 120, 220, 120, 400]); playAlarm();
    }
  }, [remainingMs, tRunning, mode]);

  const handAngle = mode === 'stopwatch'
    ? (elapsedMs % STOPWATCH_ROTATION_MS) / STOPWATCH_ROTATION_MS * 360
    : (remainingMs % ROTATION_MS) / ROTATION_MS * 360;
  const rotations = mode === 'timer' ? Math.floor(remainingMs / ROTATION_MS) : 0;

  // Wind-up drag (timer, idle only).
  function pointerAngle(e) {
    const r = dialRef.current.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    let deg = Math.atan2(dx, -dy) * 180 / Math.PI;
    if (deg < 0) deg += 360;
    return deg;
  }
  function onPointerDown(e) {
    if (mode !== 'timer' || tRunning) return;
    e.preventDefault();
    dragRef.current = { angle: pointerAngle(e), totalMs, tick: Math.round(totalMs / TICK_MS) };
    dialRef.current.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e) {
    if (!dragRef.current) return;
    e.preventDefault();
    const a = pointerAngle(e);
    let delta = a - dragRef.current.angle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    dragRef.current.angle = a;
    const next = Math.max(0, Math.min(MAX_MS, dragRef.current.totalMs + delta / 360 * ROTATION_MS));
    const snapped = Math.round(next / TICK_MS) * TICK_MS;
    if (snapped !== dragRef.current.totalMs) {
      dragRef.current.totalMs = snapped;
      const tick = Math.round(snapped / TICK_MS);
      if (tick !== dragRef.current.tick) { dragRef.current.tick = tick; vibrate(12); }
      setTotalMs(snapped);
    }
  }
  function onPointerUp(e) { if (dragRef.current) { dragRef.current = null; try { dialRef.current.releasePointerCapture(e.pointerId); } catch { /* ok */ } } }

  function switchMode(m) {
    setMode(m); setTimesUp(false); setManual(false);
    if (m === 'timer') { if (swRunning) { setSwAccum(elapsedMs); setSwRunning(false); } }
    else { if (tRunning) { setTotalMs(remainingMs); setTRunning(false); } }
  }
  function startTimer() {
    if (totalMs <= 0) return;
    startRef.current = Date.now(); startRemainingRef.current = totalMs;
    setTimesUp(false); setTRunning(true);
  }
  function pauseTimer() { setTotalMs(remainingMs); setTRunning(false); }
  function cancelTimer() { setTRunning(false); setTotalMs(0); setTimesUp(false); }
  function addMinute() {
    const next = Math.min(MAX_MS, 60000);
    setTotalMs(next); setTimesUp(false);
    startRef.current = Date.now(); startRemainingRef.current = next; setTRunning(true);
  }

  function startStopwatch() { startRef.current = Date.now(); setSwRunning(true); }
  function stopStopwatch() { setSwAccum(elapsedMs); setSwRunning(false); }
  function resetStopwatch() { setSwRunning(false); setSwAccum(0); setLaps([]); }
  function lap() {
    const prevTotal = laps.length ? laps[laps.length - 1].totalMs : 0;
    setLaps((l) => [...l, { lapMs: elapsedMs - prevTotal, totalMs: elapsedMs }]);
  }

  function submitManual() {
    const ms = parseTime(manualText);
    if (ms != null) { setTotalMs(ms); setTimesUp(false); }
    setManual(false); setManualText('');
  }

  // Button configuration
  let leftLabel, rightLabel, leftAction, rightAction, leftDisabled = false, rightDisabled = false;
  if (mode === 'timer') {
    if (timesUp) { leftLabel = 'Stop'; rightLabel = '+1 min'; leftAction = () => { setTimesUp(false); }; rightAction = addMinute; }
    else if (tRunning) { leftLabel = 'Cancel'; rightLabel = 'Pause'; leftAction = cancelTimer; rightAction = pauseTimer; }
    else { leftLabel = 'Reset'; rightLabel = 'Start'; leftAction = cancelTimer; rightAction = startTimer; leftDisabled = totalMs <= 0; rightDisabled = totalMs <= 0; }
  } else {
    if (swRunning) { leftLabel = 'Lap'; rightLabel = 'Stop'; leftAction = lap; rightAction = stopStopwatch; }
    else { leftLabel = 'Reset'; rightLabel = swAccum > 0 ? 'Resume' : 'Start'; leftAction = resetStopwatch; rightAction = startStopwatch; leftDisabled = swAccum <= 0; }
  }

  const ticks = useMemo(() => Array.from({ length: 60 }, (_, i) => {
    const major = i % 5 === 0;
    const a = polar(110, 110, major ? 92 : 99, i * 6);
    const b = polar(110, 110, 105, i * 6);
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y, major, key: i };
  }), []);

  const fastest = laps.length > 1 ? Math.min(...laps.map((l) => l.lapMs)) : null;
  const slowest = laps.length > 1 ? Math.max(...laps.map((l) => l.lapMs)) : null;

  return (
    <div className="timer-screen" role="dialog" aria-modal="true" aria-label="Timer and stopwatch">
      <div className="timer-glow" aria-hidden="true" />
      <button type="button" className="timer-close" onClick={onClose} aria-label="Close timer">✕</button>

      <div className="timer-segmented" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'timer'} className={mode === 'timer' ? 'on' : ''} onClick={() => switchMode('timer')}>Timer</button>
        <button type="button" role="tab" aria-selected={mode === 'stopwatch'} className={mode === 'stopwatch' ? 'on' : ''} onClick={() => switchMode('stopwatch')}>Stopwatch</button>
      </div>

      <div className={`timer-dial-wrap ${tRunning || swRunning ? 'is-running' : ''} ${timesUp ? 'is-up' : ''}`}>
        <svg className="timer-dial" viewBox="0 0 220 220" ref={dialRef}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          {ticks.map((t) => <line key={t.key} className={`dial-tick ${t.major ? 'major' : ''}`} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />)}
          <circle className="dial-inner" cx="110" cy="110" r="78" />
          <path className="dial-arc" d={arcPath(110, 110, 78, handAngle)} />
          <line className="dial-hand" x1="110" y1="110" x2="110" y2="38" transform={`rotate(${handAngle} 110 110)`} />
          <circle className="dial-knob" cx="110" cy="110" r="6" />
        </svg>
        <div className="timer-readout" onClick={() => { if (mode === 'timer' && !tRunning) { setManual(true); setManualText(fmtMMSS(totalMs)); } }}>
          {manual ? (
            <input autoFocus type="text" inputMode="numeric" className="timer-manual" value={manualText}
              onChange={(e) => setManualText(e.target.value)} onBlur={submitManual}
              onKeyDown={(e) => { if (e.key === 'Enter') submitManual(); }} />
          ) : mode === 'stopwatch' ? fmtMMSSHH(elapsedMs) : fmtMMSS(remainingMs)}
        </div>
        {mode === 'timer' && rotations > 0 && <div className="timer-rotations">×{rotations}</div>}
        {mode === 'timer' && !tRunning && !manual && <div className="timer-hint">{totalMs > 0 ? 'Drag the hand to set the time' : 'Wind the hand clockwise to set a time'}</div>}
      </div>

      {mode === 'stopwatch' && laps.length > 0 && (
        <div className="timer-laps">
          {laps.map((l, i) => {
            const cls = l.lapMs === fastest ? 'fastest' : l.lapMs === slowest ? 'slowest' : '';
            return <div key={i} className={`timer-lap ${cls}`}><span>Lap {i + 1}</span><b>{fmtMMSS(l.lapMs)}</b><span>{fmtMMSS(l.totalMs)}</span></div>;
          })}
        </div>
      )}

      {timesUp && <div className="timer-timesup" role="status">Time's up</div>}

      <div className="timer-controls">
        <button type="button" className="timer-btn secondary" onClick={leftAction} disabled={leftDisabled}>{leftLabel}</button>
        <button type="button" className="timer-btn primary" onClick={rightAction} disabled={rightDisabled}>{rightLabel}</button>
      </div>
    </div>
  );
}
