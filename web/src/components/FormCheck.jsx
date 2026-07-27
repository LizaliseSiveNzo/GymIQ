/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

// AI form-check. The analysis is SIMULATED for now (no real video is uploaded or
// processed) — the flow, scoring and coaching feedback are ready to swap for a
// real pose/vision model later. Results are saved to form_checks.
const EXERCISES = ['Squat', 'Bench Press', 'Deadlift', 'Overhead Press', 'Barbell Row', 'Pull-up'];

// Plausible, genuinely useful coaching cues per exercise.
const CUES = {
  'Squat': [
    { level: 'good', title: 'Good depth', detail: 'Hips broke parallel on your working reps — strong mobility and control.' },
    { level: 'warn', title: 'Knees drifting in', detail: 'Slight valgus as you fatigue. Cue: "spread the floor" and drive the knees out over the toes.' },
    { level: 'bad', title: 'Forward torso lean', detail: 'Chest dips under load. Brace harder and keep the bar over midfoot to stay upright.' },
  ],
  'Bench Press': [
    { level: 'good', title: 'Solid bar path', detail: 'Bar tracks in a consistent line from chest to lockout.' },
    { level: 'warn', title: 'Elbows flaring', detail: 'Tuck the elbows to ~45° to protect the shoulders and improve drive.' },
    { level: 'bad', title: 'Bouncing off the chest', detail: 'Control the eccentric — pause briefly on the chest instead of bouncing.' },
  ],
  'Deadlift': [
    { level: 'good', title: 'Neutral spine', detail: 'Back stays flat through the pull — great bracing.' },
    { level: 'warn', title: 'Hips rising early', detail: 'Hips shoot up before the bar moves. Push the floor away and keep chest up off the floor.' },
    { level: 'bad', title: 'Bar drifting forward', detail: 'Keep the bar against your legs; let it drift and your lower back takes the load.' },
  ],
  'Overhead Press': [
    { level: 'good', title: 'Stacked lockout', detail: 'Bar finishes over the mid-foot with the head "through the window".' },
    { level: 'warn', title: 'Leaning back', detail: 'Excessive back lean — squeeze glutes and brace to keep a vertical torso.' },
    { level: 'bad', title: 'Pressing around the head', detail: 'Move the head back slightly so the bar travels straight up, not around your face.' },
  ],
  'Barbell Row': [
    { level: 'good', title: 'Good hinge', detail: 'Consistent torso angle — you’re rowing from a stable hip hinge.' },
    { level: 'warn', title: 'Using momentum', detail: 'Slight heave with the lower back. Control the weight and row with the mid-back.' },
    { level: 'bad', title: 'Rounding at the bottom', detail: 'Keep a flat back throughout; stop the range where you can hold position.' },
  ],
  'Pull-up': [
    { level: 'good', title: 'Full range', detail: 'Dead hang to chin over the bar — full, honest reps.' },
    { level: 'warn', title: 'Kipping', detail: 'Some leg swing. For strict strength, control the swing and pull with the lats.' },
    { level: 'bad', title: 'Half reps at the top', detail: 'Not clearing the bar on later reps — reduce reps to keep them full-range.' },
  ],
};
const STEPS = ['Detecting body keypoints', 'Tracking joint angles', 'Measuring bar path & tempo', 'Comparing to ideal form', 'Writing coach feedback'];

export default function FormCheck({ clientId, readOnly = false }) {
  const [exercise, setExercise] = useState('Squat');
  const [file, setFile] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | analyzing | done
  const [step, setStep] = useState(0);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState(null);
  const timer = useRef(null);

  async function loadHistory() {
    const { data } = await supabase.from('form_checks')
      .select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(20);
    setHistory(data || []);
  }
  useEffect(() => { loadHistory(); return () => clearInterval(timer.current); }, [clientId]);

  function analyze() {
    setPhase('analyzing'); setStep(0); setResult(null);
    let i = 0;
    timer.current = setInterval(async () => {
      i += 1;
      if (i < STEPS.length) { setStep(i); return; }
      clearInterval(timer.current);
      // build a simulated result
      const cues = CUES[exercise] || CUES['Squat'];
      const score = 74 + Math.floor(Math.random() * 18); // 74–91
      const summary = score >= 85 ? 'Strong technique with a couple of things to refine.'
        : score >= 78 ? 'Solid base — a few fixable form points.'
        : 'Good effort — focus on the fundamentals below.';
      const { data } = await supabase.from('form_checks')
        .insert({ client_id: clientId, exercise, score, summary, feedback: cues, simulated: true })
        .select('*').single();
      setResult(data || { exercise, score, summary, feedback: cues });
      setPhase('done');
      loadHistory();
    }, 750);
  }

  function reset() { setPhase('idle'); setFile(null); setResult(null); setStep(0); }
  async function del(id) { await supabase.from('form_checks').delete().eq('id', id); loadHistory(); }

  const dot = { good: 'var(--success)', warn: 'var(--warning)', bad: 'var(--danger)' };

  return (
    <div className="stack">
      {!readOnly && (
        <div className="card">
          <div className="section-header"><h4 style={{ margin: 0 }}>AI form check</h4><span className="badge badge-warning">Beta · simulated</span></div>

          {phase === 'idle' && (
            <>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {EXERCISES.map((e) => (
                  <span key={e} className={`badge ${exercise === e ? 'badge-info' : 'badge-neutral'}`} style={{ cursor: 'pointer' }} onClick={() => setExercise(e)}>{e}</span>
                ))}
              </div>
              <label className="btn btn-secondary btn-block" style={{ cursor: 'pointer' }}>
                {file ? `🎥 ${file.name}` : '🎥 Choose or record a video'}
                <input type="file" accept="video/*" capture="environment" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </label>
              <button className="btn btn-primary btn-block" style={{ marginTop: 8 }} onClick={analyze}>Analyze my {exercise.toLowerCase()}</button>
              <p className="subtle" style={{ fontSize: 12, margin: '10px 0 0' }}>
                Analysis is simulated for now — it produces real coaching cues to help you practise. Live video analysis is coming.
              </p>
            </>
          )}

          {phase === 'analyzing' && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div className="accent" style={{ fontWeight: 700, color: 'var(--green-600)' }}>Analyzing {exercise}…</div>
              <div className="subtle" style={{ marginTop: 8 }}>{STEPS[step]}</div>
            </div>
          )}

          {phase === 'done' && result && (
            <div>
              <div className="row between" style={{ marginBottom: 8 }}>
                <div><strong style={{ fontSize: 18 }}>{result.exercise}</strong><div className="subtle" style={{ fontSize: 13 }}>{result.summary}</div></div>
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
                  <div><strong>{h.exercise}</strong> <span className="subtle" style={{ fontSize: 12 }}>· {new Date(h.created_at).toLocaleDateString()}</span></div>
                  <div className="row" style={{ gap: 8 }}>
                    <span className={`badge ${h.score >= 85 ? 'badge-success' : h.score >= 78 ? 'badge-info' : 'badge-warning'}`}>{h.score}/100</span>
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
