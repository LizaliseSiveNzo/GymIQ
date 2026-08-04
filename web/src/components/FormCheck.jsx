/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { createAnalyzer, scoreResult, CONNECTIONS } from '../lib/poseMetrics.js';

// Hybrid AI form check: pose estimation runs ON-DEVICE (free) via MediaPipe;
// joint angles → rep detection → transparent scoring. An optional Supabase edge
// function ('form-coach') rewrites the cues into a natural coaching paragraph
// with a cheap LLM; if it's not configured we fall back to the built-in summary.
const EXERCISES = ['Squat', 'Push-Up'];
const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export default function FormCheck({ clientId, readOnly = false }) {
  const [exercise, setExercise] = useState('Squat');
  const [mode, setMode] = useState('camera'); // camera | upload
  const [phase, setPhase] = useState('idle');  // idle | loading | ready | running | scoring | done
  const [live, setLive] = useState({ reps: 0, angle: null });
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState(null);
  const [err, setErr] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const landmarkerRef = useRef(null);
  const analyzerRef = useRef(null);
  const rafRef = useRef(null);
  const streamRef = useRef(null);
  const lastTsRef = useRef(0);
  const runningRef = useRef(false);

  async function loadHistory() {
    const { data } = await supabase.from('form_checks')
      .select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(20);
    setHistory(data || []);
  }
  useEffect(() => { loadHistory(); return cleanup; }, [clientId]);

  function cleanup() {
    runningRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
  }

  async function getLandmarker() {
    if (landmarkerRef.current) return landmarkerRef.current;
    const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
    const fileset = await FilesetResolver.forVisionTasks(WASM);
    landmarkerRef.current = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
      runningMode: 'VIDEO', numPoses: 1,
    });
    return landmarkerRef.current;
  }

  function draw(lm) {
    const cv = canvasRef.current, v = videoRef.current;
    if (!cv || !v) return;
    const w = v.videoWidth || 640, h = v.videoHeight || 480;
    if (cv.width !== w) { cv.width = w; cv.height = h; }
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    if (!lm) return;
    ctx.strokeStyle = '#c6f542'; ctx.lineWidth = Math.max(2, w / 240);
    CONNECTIONS.forEach(([a, b]) => {
      if (!lm[a] || !lm[b]) return;
      ctx.beginPath(); ctx.moveTo(lm[a].x * w, lm[a].y * h); ctx.lineTo(lm[b].x * w, lm[b].y * h); ctx.stroke();
    });
    ctx.fillStyle = '#ffffff';
    lm.forEach((p) => { if (p && (p.visibility ?? 1) > 0.5) { ctx.beginPath(); ctx.arc(p.x * w, p.y * h, Math.max(3, w / 180), 0, 7); ctx.fill(); } });
  }

  function loop() {
    const v = videoRef.current, lmk = landmarkerRef.current;
    if (!runningRef.current || !v || !lmk) return;
    let ts = Math.round(performance.now());
    if (ts <= lastTsRef.current) ts = lastTsRef.current + 1;
    lastTsRef.current = ts;
    try {
      const out = lmk.detectForVideo(v, ts);
      const lm = out?.landmarks?.[0] || null;
      draw(lm);
      if (lm) {
        analyzerRef.current.push(lm, v.currentTime || ts / 1000);
        const st = analyzerRef.current.live();
        const a = analyzerRef.current.def.primary(lm);
        setLive({ reps: st.reps, angle: a == null ? null : Math.round(a) });
      }
    } catch { /* frame skipped */ }
    if (mode === 'upload' && v.ended) { finish(); return; }
    rafRef.current = requestAnimationFrame(loop);
  }

  async function startCamera() {
    setErr(''); setPhase('loading');
    try {
      await getLandmarker();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640 }, audio: false });
      streamRef.current = stream;
      const v = videoRef.current; v.srcObject = stream; await v.play();
      analyzerRef.current = createAnalyzer(exercise);
      lastTsRef.current = 0; runningRef.current = true;
      setLive({ reps: 0, angle: null }); setPhase('running');
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) { setErr(cameraErr(e)); setPhase('idle'); }
  }

  async function startUpload(file) {
    if (!file) return;
    setErr(''); setPhase('loading');
    try {
      await getLandmarker();
      const v = videoRef.current; v.srcObject = null; v.src = URL.createObjectURL(file); v.muted = true;
      await v.play();
      analyzerRef.current = createAnalyzer(exercise);
      lastTsRef.current = 0; runningRef.current = true;
      setLive({ reps: 0, angle: null }); setPhase('running');
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) { setErr('Could not read that video. Try a different file or use the camera.'); setPhase('idle'); }
  }

  async function finish() {
    if (phase === 'scoring' || phase === 'done') return;
    runningRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setPhase('scoring');
    const raw = analyzerRef.current.finish();
    const scored = scoreResult(exercise, raw);

    // Optional cheap-LLM polish; silently fall back to the built-in summary.
    let summary = scored.summary;
    try {
      const { data } = await supabase.functions.invoke('form-coach', { body: { exercise, score: scored.score, reps: scored.reps, metrics: scored.metrics, cues: scored.cues } });
      if (data?.summary) summary = data.summary;
    } catch { /* fall back */ }

    const { data: saved } = await supabase.from('form_checks')
      .insert({ client_id: clientId, exercise, score: scored.score, reps: scored.reps, summary, feedback: scored.cues, metrics: scored.metrics, simulated: false })
      .select('*').single();
    setResult(saved || { exercise, score: scored.score, reps: scored.reps, summary, feedback: scored.cues });
    setPhase('done'); loadHistory();
  }

  function reset() { cleanup(); setResult(null); setPhase('idle'); setLive({ reps: 0, angle: null }); setErr(''); }
  async function del(id) { await supabase.from('form_checks').delete().eq('id', id); loadHistory(); }

  const dot = { good: 'var(--success)', warn: 'var(--warning)', bad: 'var(--danger)' };
  const showStage = !readOnly && (phase === 'running' || phase === 'loading' || phase === 'scoring');

  return (
    <div className="stack">
      {!readOnly && (
        <div className="card">
          <div className="section-header"><h4 style={{ margin: 0 }}>AI form check</h4><span className="badge badge-info">On-device · free</span></div>

          {phase === 'idle' && (
            <>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                {EXERCISES.map((e) => (
                  <span key={e} className={`badge ${exercise === e ? 'badge-info' : 'badge-neutral'}`} style={{ cursor: 'pointer' }} onClick={() => setExercise(e)}>{e}</span>
                ))}
              </div>
              <div className="row" style={{ gap: 8, marginBottom: 12 }}>
                <button className={`btn ${mode === 'camera' ? 'btn-secondary' : 'btn-ghost'}`} style={{ flex: 1 }} onClick={() => setMode('camera')}>📷 Camera</button>
                <button className={`btn ${mode === 'upload' ? 'btn-secondary' : 'btn-ghost'}`} style={{ flex: 1 }} onClick={() => setMode('upload')}>🎞️ Upload video</button>
              </div>
              {mode === 'camera'
                ? <button className="btn btn-primary btn-block" onClick={startCamera}>Start camera & analyze {exercise.toLowerCase()}</button>
                : <label className="btn btn-primary btn-block" style={{ cursor: 'pointer' }}>Choose a video of your {exercise.toLowerCase()}
                    <input type="file" accept="video/*" style={{ display: 'none' }} onChange={(e) => startUpload(e.target.files?.[0])} />
                  </label>}
              {err && <p style={{ color: 'var(--danger)', fontSize: 13, margin: '10px 0 0' }}>{err}</p>}
              <p className="subtle" style={{ fontSize: 12, margin: '10px 0 0' }}>
                Film <strong>side-on</strong> with your whole body in frame. Pose tracking runs privately on your device — the video never leaves your phone.
              </p>
            </>
          )}

          {showStage && (
            <div>
              <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#000', aspectRatio: '4 / 3' }}>
                <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'contain', transform: mode === 'camera' ? 'scaleX(-1)' : 'none' }} />
                <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', transform: mode === 'camera' ? 'scaleX(-1)' : 'none' }} />
                {phase === 'running' && (
                  <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 8 }}>
                    <span className="badge" style={{ background: 'rgba(0,0,0,.6)', color: '#fff' }}>Reps {live.reps}</span>
                    {live.angle != null && <span className="badge" style={{ background: 'rgba(0,0,0,.6)', color: '#fff' }}>{live.angle}°</span>}
                  </div>
                )}
              </div>
              {phase === 'loading' && <p className="subtle" style={{ textAlign: 'center', marginTop: 10 }}>Loading pose model…</p>}
              {phase === 'scoring' && <p className="subtle" style={{ textAlign: 'center', marginTop: 10 }}>Scoring your reps…</p>}
              {phase === 'running' && (
                <div className="row" style={{ gap: 8, marginTop: 10 }}>
                  {mode === 'camera' && <button className="btn btn-primary" style={{ flex: 1 }} onClick={finish} disabled={live.reps === 0}>Finish & score ({live.reps} rep{live.reps === 1 ? '' : 's'})</button>}
                  <button className="btn btn-ghost" onClick={reset}>Cancel</button>
                </div>
              )}
            </div>
          )}

          {phase === 'done' && result && (
            <div>
              <div className="row between" style={{ marginBottom: 8 }}>
                <div><strong style={{ fontSize: 18 }}>{result.exercise}</strong><div className="subtle" style={{ fontSize: 13 }}>{result.summary}</div>
                  <div className="subtle" style={{ fontSize: 12, marginTop: 2 }}>{result.reps} rep{result.reps === 1 ? '' : 's'} analysed</div></div>
                <div style={{ textAlign: 'right' }}><div className="kpi-value accent" style={{ color: 'var(--green-600)', fontSize: 30 }}>{result.score}</div><div className="subtle" style={{ fontSize: 12 }}>/ 100</div></div>
              </div>
              <div className="stack" style={{ gap: 8, marginTop: 8 }}>
                {(result.feedback || []).map((c, i) => (
                  <div key={i} className="row" style={{ gap: 10, border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: dot[c.level], marginTop: 5, flexShrink: 0 }} />
                    <div><strong>{c.title}</strong><div className="subtle" style={{ fontSize: 13 }}>{c.detail}</div></div>
                  </div>
                ))}
              </div>
              <button className="btn btn-secondary btn-block" style={{ marginTop: 12 }} onClick={reset}>Analyze another lift</button>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h4 style={{ marginTop: 0 }}>{readOnly ? 'Client form checks' : 'History'}</h4>
        {history === null ? <p className="subtle" style={{ margin: 0 }}>Loading…</p>
         : history.length === 0 ? <p className="subtle" style={{ margin: 0 }}>{readOnly ? 'No form checks yet.' : 'No checks yet — analyze a lift above.'}</p>
         : (
          <div className="stack" style={{ gap: 8 }}>
            {history.map((h) => (
              <div key={h.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
                <div className="row between">
                  <div><strong>{h.exercise}</strong> <span className="subtle" style={{ fontSize: 12 }}>· {new Date(h.created_at).toLocaleDateString()}{h.reps ? ` · ${h.reps} reps` : ''}</span></div>
                  <div className="row" style={{ gap: 8 }}>
                    <span className={`badge ${h.score >= 85 ? 'badge-success' : h.score >= 70 ? 'badge-info' : 'badge-warning'}`}>{h.score}/100</span>
                    {!readOnly && <button className="btn btn-ghost" style={{ minHeight: 24, padding: '0 8px' }} onClick={() => del(h.id)}>✕</button>}
                  </div>
                </div>
                {h.summary && <div className="subtle" style={{ fontSize: 12, marginTop: 4 }}>{h.summary}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function cameraErr(e) {
  if (e?.name === 'NotAllowedError') return 'Camera permission was blocked. Allow camera access and try again, or upload a video instead.';
  if (e?.name === 'NotFoundError') return 'No camera found. Upload a video instead.';
  return 'Could not start the camera. Try uploading a video instead.';
}
