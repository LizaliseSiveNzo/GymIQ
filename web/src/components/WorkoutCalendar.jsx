/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useMemo, useState } from 'react';
import Calendar from './Calendar.jsx';
import { supabase } from '../lib/supabaseClient.js';

const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const weekdayOf = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).getDay(); };
const watchUrl = (ex) => (ex.video_url && ex.video_url.trim())
  ? ex.video_url.trim()
  : `https://www.youtube.com/results?search_query=${encodeURIComponent(`${ex.name} proper form technique`)}`;

// Calendar-driven workout planner. A day's plan repeats weekly on that weekday by
// default; a specific date can be overridden. Editable by the client (their own
// id) and the trainer (a client's id) — RLS scopes it. readOnly hides editing.
export default function WorkoutCalendar({ clientId, readOnly = false }) {
  const [recurring, setRecurring] = useState({}); // weekday -> { plan, exercises }
  const [overrides, setOverrides] = useState({}); // dateIso -> { plan, exercises }
  const [events, setEvents] = useState([]);
  const [sel, setSel] = useState(null);            // selected date iso
  const [exForm, setExForm] = useState({ name: '', sets: '', reps: '', weight: '', video: '' });
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [{ data: plans }, { data: exs }, appts, logs, journal, metrics] = await Promise.all([
      supabase.from('day_plans').select('*').eq('client_id', clientId),
      supabase.from('day_plan_exercises').select('*').eq('client_id', clientId).order('sort_order'),
      supabase.from('appointments').select('starts_at').eq('client_id', clientId),
      supabase.from('workout_logs').select('log_date, logged_sets(id)').eq('client_id', clientId).limit(300),
      supabase.from('client_journal').select('entry_date').eq('client_id', clientId).limit(300),
      supabase.from('body_metrics').select('metric_date').eq('client_id', clientId).limit(300),
    ]);
    const exByPlan = {};
    (exs || []).forEach((e) => { (exByPlan[e.plan_id] ||= []).push(e); });
    const rec = {}, ovr = {};
    (plans || []).forEach((p) => {
      const entry = { plan: p, exercises: exByPlan[p.id] || [] };
      if (p.plan_date) ovr[p.plan_date] = entry; else if (p.weekday != null) rec[p.weekday] = entry;
    });
    setRecurring(rec); setOverrides(ovr);

    const ev = [];
    (appts.data || []).forEach((a) => ev.push({ date: a.starts_at.slice(0, 10), kind: 'appointment', label: 'Session with trainer' }));
    (logs.data || []).forEach((l) => ev.push({ date: l.log_date, kind: 'session', label: `Logged · ${l.logged_sets?.length || 0} sets` }));
    (journal.data || []).forEach((j) => ev.push({ date: j.entry_date, kind: 'journal', label: 'Journal note' }));
    (metrics.data || []).forEach((mm) => ev.push({ date: mm.metric_date, kind: 'metric', label: 'Check-in' }));
    setEvents(ev);
    setLoading(false);
  }
  useEffect(() => { load(); }, [clientId]);

  const resolveDay = useMemo(() => (dateIso, weekday) => {
    const o = overrides[dateIso];
    if (o) return { count: o.exercises.length, title: o.plan.title || 'Workout' };
    const r = recurring[weekday];
    if (r) return { count: r.exercises.length, title: r.plan.title || 'Workout' };
    return null;
  }, [overrides, recurring]);

  // active plan for the selected date
  const selWeekday = sel ? weekdayOf(sel) : null;
  const override = sel ? overrides[sel] : null;
  const weekly = selWeekday != null ? recurring[selWeekday] : null;
  const active = override || weekly || null;
  const isOverride = !!override;

  useEffect(() => { setTitle(active?.plan?.title || ''); setExForm({ name: '', sets: '', reps: '', weight: '', video: '' }); }, [sel, active?.plan?.id]);

  async function getOrCreateWeekly() {
    if (recurring[selWeekday]?.plan) return recurring[selWeekday].plan;
    const { data } = await supabase.from('day_plans').insert({ client_id: clientId, weekday: selWeekday, title: 'Workout' }).select('*').single();
    await load(); return data;
  }
  async function makeOverride() {
    const w = recurring[selWeekday];
    const { data: plan } = await supabase.from('day_plans').insert({ client_id: clientId, plan_date: sel, title: w?.plan?.title || 'Workout' }).select('*').single();
    if (w?.exercises?.length) {
      await supabase.from('day_plan_exercises').insert(w.exercises.map((e) => ({
        client_id: clientId, plan_id: plan.id, name: e.name, target_sets: e.target_sets,
        target_reps: e.target_reps, target_weight: e.target_weight, video_url: e.video_url, sort_order: e.sort_order,
      })));
    }
    await load();
  }
  async function removeOverride() { if (override) { await supabase.from('day_plans').delete().eq('id', override.plan.id); await load(); } }

  async function saveTitle() {
    if (!active) return;
    await supabase.from('day_plans').update({ title: title.trim() || 'Workout' }).eq('id', active.plan.id);
    load();
  }
  async function addExercise() {
    if (!exForm.name.trim()) return;
    let planId = active?.plan?.id;
    if (!planId) { const p = await getOrCreateWeekly(); planId = p.id; }
    await supabase.from('day_plan_exercises').insert({
      client_id: clientId, plan_id: planId, name: exForm.name.trim(),
      target_sets: exForm.sets ? parseInt(exForm.sets, 10) : null,
      target_reps: exForm.reps || null,
      target_weight: exForm.weight ? parseFloat(exForm.weight) : null,
      video_url: exForm.video.trim() || null,
      sort_order: (active?.exercises?.length || 0),
    });
    setExForm({ name: '', sets: '', reps: '', weight: '', video: '' });
    load();
  }
  async function delExercise(id) { await supabase.from('day_plan_exercises').delete().eq('id', id); load(); }

  return (
    <div className="stack">
      <Calendar events={events} title="Workout calendar" resolveDay={resolveDay} onSelectDay={setSel} />

      {sel && (
        <div className="card">
          <div className="section-header">
            <div>
              <h4 style={{ margin: 0 }}>{new Date(sel).toDateString()}</h4>
              <div className="subtle" style={{ fontSize: 12 }}>
                {isOverride ? 'Just this day' : `Every ${WD[selWeekday]}`}
              </div>
            </div>
            <button className="btn btn-ghost" style={{ minHeight: 30 }} onClick={() => setSel(null)}>Close</button>
          </div>

          {!active ? (
            <p className="subtle" style={{ margin: 0 }}>
              {readOnly ? 'No workout planned for this day.' : `No workout yet. Add exercises below — they’ll repeat every ${WD[selWeekday]}.`}
            </p>
          ) : (
            <>
              {!readOnly ? (
                <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  <input className="input" style={{ flex: 1, minWidth: 180 }} placeholder="Day title (e.g. Legs & Arms)"
                    value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveTitle} />
                </div>
              ) : <strong>{active.plan.title || 'Workout'}</strong>}

              <div className="stack" style={{ gap: 6, margin: '4px 0 10px' }}>
                {active.exercises.length === 0 ? <p className="subtle" style={{ margin: 0 }}>No exercises yet.</p>
                 : active.exercises.map((e) => (
                  <div key={e.id} className="row between" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px' }}>
                    <div>
                      <strong>{e.name}</strong>
                      <div className="subtle" style={{ fontSize: 12 }}>
                        {e.target_sets ? `${e.target_sets}×` : ''}{e.target_reps || ''}{e.target_weight ? ` @ ${e.target_weight}kg` : ''}
                      </div>
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      <a href={watchUrl(e)} target="_blank" rel="noopener noreferrer" className="badge badge-info" style={{ textDecoration: 'none' }}>▶ Watch</a>
                      {!readOnly && <button className="btn btn-ghost" style={{ minHeight: 26, padding: '0 8px' }} onClick={() => delExercise(e.id)}>✕</button>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {!readOnly && (
            <>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                <input className="input" style={{ flex: 2, minWidth: 140 }} placeholder="Exercise"
                  value={exForm.name} onChange={(e) => setExForm({ ...exForm, name: e.target.value })} />
                <input className="input" style={{ width: 64 }} type="number" placeholder="sets"
                  value={exForm.sets} onChange={(e) => setExForm({ ...exForm, sets: e.target.value })} />
                <input className="input" style={{ width: 80 }} placeholder="reps"
                  value={exForm.reps} onChange={(e) => setExForm({ ...exForm, reps: e.target.value })} />
                <input className="input" style={{ width: 72 }} type="number" placeholder="kg"
                  value={exForm.weight} onChange={(e) => setExForm({ ...exForm, weight: e.target.value })} />
              </div>
              <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                <input className="input" style={{ flex: 1, minWidth: 180 }} placeholder="Video link (optional — leave blank to auto-search YouTube)"
                  value={exForm.video} onChange={(e) => setExForm({ ...exForm, video: e.target.value })} />
                <button className="btn btn-secondary" style={{ minHeight: 40 }} disabled={!exForm.name.trim()} onClick={addExercise}>Add exercise</button>
              </div>

              {/* recurring vs one-off controls */}
              <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                {!isOverride
                  ? <button className="btn btn-ghost" onClick={makeOverride} disabled={!active}>Change just this day</button>
                  : <button className="btn btn-ghost" onClick={removeOverride}>Use the weekly plan instead</button>}
                <span className="subtle" style={{ fontSize: 12, alignSelf: 'center' }}>
                  {isOverride ? 'Edits here apply only to this date.' : `Edits here repeat every ${WD[selWeekday]}.`}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {loading && <p className="subtle" style={{ fontSize: 12 }}>Syncing…</p>}
    </div>
  );
}
