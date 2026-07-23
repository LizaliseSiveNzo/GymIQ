/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import Calendar from '../components/Calendar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient.js';

const TABS = ['My plan', 'Log session', 'Progress', 'Nutrition', 'Calendar', 'Journal'];

// The client's own view. All reads/writes are scoped to their own client_id
// (= auth.uid) by RLS, so no id needs to be passed around.
export default function PlayerProfile() {
  const { session, profile } = useAuth();
  const [tab, setTab] = useState('My plan');

  if (session?.demo)
    return <AppShell role="player" active="Home" title="Home"><div className="card">Demo mode — sign in as a client to see your plan.</div></AppShell>;
  if (!profile) return <AppShell role="player" active="Home" title="Home"><div className="card">Loading…</div></AppShell>;

  const cid = profile.id;
  return (
    <AppShell role="player" active="Home" title="Home">
      <div className="card" style={{ marginBottom: 16 }}>
        <strong style={{ fontSize: 18 }}>Hi, {profile.name?.split(' ')[0] || 'there'} 👋</strong>
        <div className="subtle" style={{ fontSize: 13 }}>Your training, progress and nutrition — all in one place.</div>
        <div className="segmented" style={{ marginTop: 14, flexWrap: 'wrap' }}>
          {TABS.map((t) => <button key={t} type="button" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>)}
        </div>
      </div>

      {tab === 'My plan'     && <MyPlan cid={cid} />}
      {tab === 'Log session' && <LogSession cid={cid} />}
      {tab === 'Progress'    && <Progress cid={cid} />}
      {tab === 'Nutrition'   && <Nutrition cid={cid} />}
      {tab === 'Calendar'    && <MyCalendar cid={cid} />}
      {tab === 'Journal'     && <MyJournal cid={cid} />}
    </AppShell>
  );
}

/* --------------------------------------------------------- shared: load plan */
function useProgramme(cid) {
  const [state, setState] = useState({ prog: undefined, days: [], ex: {} });
  useEffect(() => { (async () => {
    const { data: p } = await supabase.from('workout_programmes')
      .select('*').eq('client_id', cid).eq('is_active', true).limit(1);
    const prog = p?.[0] || null;
    if (!prog) { setState({ prog: null, days: [], ex: {} }); return; }
    const { data: dd } = await supabase.from('programme_days').select('*').eq('programme_id', prog.id).order('sort_order');
    const dayIds = (dd || []).map((d) => d.id);
    let ex = {};
    if (dayIds.length) {
      const { data: xx } = await supabase.from('programme_exercises').select('*').in('day_id', dayIds).order('sort_order');
      (xx || []).forEach((e) => { (ex[e.day_id] ||= []).push(e); });
    }
    setState({ prog, days: dd || [], ex });
  })(); }, [cid]);
  return state;
}

/* ------------------------------------------------------------------- My plan */
function MyPlan({ cid }) {
  const { prog, days, ex } = useProgramme(cid);
  if (prog === undefined) return <div className="card">Loading…</div>;
  if (!prog) return <div className="card"><p className="subtle" style={{ margin: 0 }}>Your trainer hasn't set a programme yet.</p></div>;
  return (
    <div className="stack">
      <div className="card"><h4 style={{ margin: 0 }}>{prog.name}</h4></div>
      {days.map((day) => (
        <div className="card" key={day.id}>
          <h4 style={{ marginTop: 0 }}>{day.name}</h4>
          {(ex[day.id] || []).length === 0 ? <p className="subtle" style={{ margin: 0 }}>No exercises.</p> : (
            <table className="table"><thead><tr><th>Exercise</th><th>Sets</th><th>Reps</th><th>Weight</th></tr></thead>
              <tbody>{(ex[day.id] || []).map((e) => (
                <tr key={e.id}><td>{e.name}</td><td>{e.target_sets ?? '—'}</td><td>{e.target_reps || '—'}</td><td>{e.target_weight != null ? `${e.target_weight}kg` : '—'}</td></tr>
              ))}</tbody></table>
          )}
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- Log session */
function LogSession({ cid }) {
  const { prog, days, ex } = useProgramme(cid);
  const [dayId, setDayId] = useState('');
  const [rows, setRows] = useState([]);      // { exercise_name, weight, reps }
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  // When a day is picked, prefill a row per exercise.
  function pickDay(id) {
    setDayId(id);
    if (id && ex[id]) setRows(ex[id].map((e) => ({ exercise_name: e.name, weight: '', reps: '', pex: e.id })));
    else setRows([{ exercise_name: '', weight: '', reps: '', pex: null }]);
  }
  function setRow(i, k, v) { setRows((r) => r.map((row, j) => j === i ? { ...row, [k]: v } : row)); }
  function addRow() { setRows((r) => [...r, { exercise_name: '', weight: '', reps: '', pex: null }]); }
  function delRow(i) { setRows((r) => r.filter((_, j) => j !== i)); }

  async function save() {
    const valid = rows.filter((r) => r.exercise_name.trim() && (r.weight || r.reps));
    if (valid.length === 0) { setMsg('Add at least one exercise with a weight or reps.'); return; }
    setBusy(true); setMsg('');
    try {
      const { data: log, error } = await supabase.from('workout_logs')
        .insert({ client_id: cid, day_id: dayId || null, note: note.trim() || null })
        .select('id').single();
      if (error) { setMsg(error.message); return; }
      const sets = valid.map((r, idx) => ({
        client_id: cid, log_id: log.id, exercise_name: r.exercise_name.trim(),
        programme_exercise_id: r.pex || null, set_number: idx + 1,
        weight: r.weight ? parseFloat(r.weight) : null, reps: r.reps ? parseInt(r.reps, 10) : null,
      }));
      const { error: e2 } = await supabase.from('logged_sets').insert(sets);
      if (e2) { setMsg(e2.message); return; }
      setMsg('Session saved 💪');
      setRows([]); setDayId(''); setNote('');
    } finally { setBusy(false); }
  }

  if (prog === undefined) return <div className="card">Loading…</div>;
  return (
    <div className="card">
      <h4 style={{ marginTop: 0 }}>Log today's session</h4>
      <div className="field">
        <label className="label">Which day?</label>
        <select className="select" value={dayId} onChange={(e) => pickDay(e.target.value)}>
          <option value="">Freeform (no plan)</option>
          {days.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {rows.length === 0 ? <p className="subtle">Pick a day to load its exercises, or add one below.</p> : (
        <div className="stack" style={{ gap: 8 }}>
          {rows.map((r, i) => (
            <div key={i} className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              <input className="input" style={{ flex: 2, minWidth: 140 }} placeholder="Exercise"
                value={r.exercise_name} onChange={(e) => setRow(i, 'exercise_name', e.target.value)} />
              <input className="input" style={{ flex: 1, minWidth: 70 }} type="number" step="0.5" placeholder="kg"
                value={r.weight} onChange={(e) => setRow(i, 'weight', e.target.value)} />
              <input className="input" style={{ flex: 1, minWidth: 60 }} type="number" placeholder="reps"
                value={r.reps} onChange={(e) => setRow(i, 'reps', e.target.value)} />
              <button className="btn btn-ghost" style={{ minHeight: 40 }} onClick={() => delRow(i)}>✕</button>
            </div>
          ))}
        </div>
      )}
      <button className="btn btn-secondary" style={{ marginTop: 10 }} onClick={addRow}>+ Add exercise</button>

      <div className="field" style={{ marginTop: 12 }}>
        <label className="label">Note (optional)</label>
        <input className="input" placeholder="How did it feel?" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      <button className="btn btn-primary btn-block" style={{ marginTop: 8 }} disabled={busy} onClick={save}>
        {busy ? 'Saving…' : 'Save session'}
      </button>
      {msg && <p style={{ color: msg.includes('saved') ? 'var(--success)' : 'var(--danger)', fontSize: 13, marginTop: 10 }}>{msg}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ Progress */
function Progress({ cid }) {
  const [rows, setRows] = useState(null);
  const [w, setW] = useState('');
  const [bf, setBf] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase.from('body_metrics').select('*').eq('client_id', cid).order('metric_date', { ascending: false }).limit(60);
    setRows(data || []);
  }
  useEffect(() => { load(); }, [cid]);

  async function add(e) {
    e.preventDefault();
    if (!w) return;
    setBusy(true);
    try {
      await supabase.from('body_metrics').upsert({
        client_id: cid, metric_date: new Date().toISOString().slice(0, 10),
        weight_kg: parseFloat(w), body_fat_pct: bf ? parseFloat(bf) : null,
      }, { onConflict: 'client_id,metric_date' });
      setW(''); setBf(''); load();
    } finally { setBusy(false); }
  }

  const chrono = rows ? [...rows].reverse() : [];
  const pts = chrono.map((r) => r.weight_kg).filter((x) => x != null);
  const delta = pts.length > 1 ? pts[pts.length - 1] - pts[0] : null;

  return (
    <div className="stack">
      <div className="card">
        <div className="section-header"><h4 style={{ margin: 0 }}>Your weight</h4>
          {delta != null && <span className={`badge ${delta <= 0 ? 'badge-success' : 'badge-warning'}`}>{delta > 0 ? '+' : ''}{delta.toFixed(1)}kg</span>}</div>
        <Sparkline points={pts} />
        <form onSubmit={add} className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <input className="input" style={{ maxWidth: 130 }} type="number" step="0.1" placeholder="Weight kg" value={w} onChange={(e) => setW(e.target.value)} />
          <input className="input" style={{ maxWidth: 130 }} type="number" step="0.1" placeholder="Body fat %" value={bf} onChange={(e) => setBf(e.target.value)} />
          <button className="btn btn-primary" disabled={busy || !w}>Log today</button>
        </form>
      </div>
      <div className="card">
        <h4 style={{ marginTop: 0 }}>History</h4>
        {rows === null ? <p className="subtle">Loading…</p>
         : rows.length === 0 ? <p className="subtle" style={{ margin: 0 }}>No entries yet.</p>
         : <table className="table"><thead><tr><th>Date</th><th>Weight</th><th>Body fat</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.id}><td>{r.metric_date}</td><td>{r.weight_kg != null ? `${r.weight_kg}kg` : '—'}</td><td>{r.body_fat_pct != null ? `${r.body_fat_pct}%` : '—'}</td></tr>)}</tbody></table>}
      </div>
    </div>
  );
}

function Sparkline({ points }) {
  if (!points || points.length < 2) return <p className="subtle" style={{ fontSize: 12, margin: 0 }}>Log at least two entries to see a trend.</p>;
  const w = 300, h = 60, min = Math.min(...points), max = Math.max(...points), range = max - min || 1;
  const step = w / (points.length - 1);
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(1)} ${(h - ((p - min) / range) * h).toFixed(1)}`).join(' ');
  return <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 60 }} preserveAspectRatio="none"><path d={d} fill="none" stroke="var(--green-600)" strokeWidth="2" /></svg>;
}

/* ----------------------------------------------------------------- Nutrition */
function Nutrition({ cid }) {
  const [plan, setPlan] = useState(undefined);
  const [items, setItems] = useState([]);
  const [today, setToday] = useState(null);
  const [f, setF] = useState({ kcal: '', protein_g: '', carbs_g: '', fat_g: '' });
  const dateStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  async function load() {
    const { data: p } = await supabase.from('nutrition_plans').select('*').eq('client_id', cid).eq('is_active', true).limit(1);
    const pl = p?.[0] || null;
    setPlan(pl);
    if (pl) { const { data: mi } = await supabase.from('meal_plan_items').select('*').eq('plan_id', pl.id).order('sort_order'); setItems(mi || []); }
    const { data: fl } = await supabase.from('food_logs').select('*').eq('client_id', cid).eq('log_date', dateStr).limit(1);
    const t = fl?.[0] || null;
    setToday(t);
    if (t) setF({ kcal: t.kcal ?? '', protein_g: t.protein_g ?? '', carbs_g: t.carbs_g ?? '', fat_g: t.fat_g ?? '' });
  }
  useEffect(() => { load(); }, [cid]);

  async function saveLog(e) {
    e.preventDefault();
    const payload = {
      client_id: cid, log_date: dateStr,
      kcal: f.kcal ? parseInt(f.kcal, 10) : null, protein_g: f.protein_g ? parseInt(f.protein_g, 10) : null,
      carbs_g: f.carbs_g ? parseInt(f.carbs_g, 10) : null, fat_g: f.fat_g ? parseInt(f.fat_g, 10) : null,
    };
    if (today) await supabase.from('food_logs').update(payload).eq('id', today.id);
    else await supabase.from('food_logs').insert(payload);
    load();
  }

  if (plan === undefined) return <div className="card">Loading…</div>;
  return (
    <div className="stack">
      <div className="card">
        <h4 style={{ marginTop: 0 }}>Daily targets</h4>
        {plan ? (
          <div className="grid grid-4">
            <div className="kpi"><div className="kpi-label">Calories</div><div className="kpi-value" style={{ fontSize: 22 }}>{plan.daily_kcal ?? '—'}</div></div>
            <div className="kpi"><div className="kpi-label">Protein</div><div className="kpi-value" style={{ fontSize: 22 }}>{plan.protein_g ?? '—'}g</div></div>
            <div className="kpi"><div className="kpi-label">Carbs</div><div className="kpi-value" style={{ fontSize: 22 }}>{plan.carbs_g ?? '—'}g</div></div>
            <div className="kpi"><div className="kpi-label">Fat</div><div className="kpi-value" style={{ fontSize: 22 }}>{plan.fat_g ?? '—'}g</div></div>
          </div>
        ) : <p className="subtle" style={{ margin: 0 }}>Your trainer hasn't set targets yet.</p>}
      </div>

      {items.length > 0 && (
        <div className="card">
          <h4 style={{ marginTop: 0 }}>Your meal plan</h4>
          <div className="stack" style={{ gap: 6 }}>
            {items.map((m) => (
              <div key={m.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px' }}>
                <strong>{m.meal}</strong> <span className="subtle">{m.description}</span>
                {m.kcal != null && <div className="subtle" style={{ fontSize: 12 }}>{m.kcal} kcal</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h4 style={{ marginTop: 0 }}>Log today's intake</h4>
        <form onSubmit={saveLog} className="grid grid-4" style={{ gap: 10 }}>
          {[['kcal', 'Calories'], ['protein_g', 'Protein g'], ['carbs_g', 'Carbs g'], ['fat_g', 'Fat g']].map(([k, label]) => (
            <div className="field" key={k} style={{ margin: 0 }}>
              <label className="label">{label}</label>
              <input className="input" type="number" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
            </div>
          ))}
          <button className="btn btn-primary" style={{ gridColumn: '1 / -1' }}>{today ? 'Update today' : 'Save today'}</button>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Calendar */
function MyCalendar({ cid }) {
  const [events, setEvents] = useState(null);
  useEffect(() => { (async () => {
    const [appts, logs, journal, metrics] = await Promise.all([
      supabase.from('appointments').select('starts_at, duration_min, note').eq('client_id', cid),
      supabase.from('workout_logs').select('log_date, note, logged_sets(id)').eq('client_id', cid).limit(300),
      supabase.from('client_journal').select('entry_date, body').eq('client_id', cid).limit(300),
      supabase.from('body_metrics').select('metric_date, weight_kg').eq('client_id', cid).limit(300),
    ]);
    const ev = [];
    (appts.data || []).forEach((a) => ev.push({ date: a.starts_at.slice(0, 10), kind: 'appointment', label: `Session · ${a.duration_min} min${a.note ? ` (${a.note})` : ''}` }));
    (logs.data || []).forEach((l) => ev.push({ date: l.log_date, kind: 'session', label: `Workout · ${l.logged_sets?.length || 0} sets` }));
    (journal.data || []).forEach((j) => ev.push({ date: j.entry_date, kind: 'journal', label: `Journal: ${j.body.slice(0, 60)}` }));
    (metrics.data || []).forEach((m) => ev.push({ date: m.metric_date, kind: 'metric', label: `Check-in${m.weight_kg != null ? ` · ${m.weight_kg}kg` : ''}` }));
    setEvents(ev);
  })(); }, [cid]);
  if (events === null) return <div className="card">Loading…</div>;
  return <Calendar events={events} title="My month" />;
}

/* ------------------------------------------------------------------- Journal */
function MyJournal({ cid }) {
  const [entries, setEntries] = useState(null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase.from('client_journal')
      .select('*').eq('client_id', cid).order('entry_date', { ascending: false }).order('created_at', { ascending: false });
    setEntries(data || []);
  }
  useEffect(() => { load(); }, [cid]);

  async function add(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      await supabase.from('client_journal').insert({ client_id: cid, body: body.trim() });
      setBody(''); load();
    } finally { setBusy(false); }
  }
  async function del(id) { await supabase.from('client_journal').delete().eq('id', id); load(); }

  return (
    <div className="stack">
      <div className="card">
        <h4 style={{ marginTop: 0 }}>Add a note</h4>
        <p className="subtle" style={{ fontSize: 12, marginTop: 0 }}>Jot down how you're feeling, cravings, energy, sleep — your trainer can see these.</p>
        <form onSubmit={add}>
          <textarea className="textarea" placeholder="What's on your mind today?" value={body} onChange={(e) => setBody(e.target.value)} />
          <button className="btn btn-primary" style={{ marginTop: 8 }} disabled={busy || !body.trim()}>Save note</button>
        </form>
      </div>
      {entries === null ? <div className="card">Loading…</div>
       : entries.length === 0 ? <div className="card"><p className="subtle" style={{ margin: 0 }}>No notes yet.</p></div>
       : entries.map((e) => (
        <div className="card" key={e.id}>
          <div className="row between">
            <span className="subtle" style={{ fontSize: 12 }}>{e.entry_date}</span>
            <button className="btn btn-ghost" style={{ minHeight: 26 }} onClick={() => del(e.id)}>Delete</button>
          </div>
          <p style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{e.body}</p>
        </div>
      ))}
    </div>
  );
}
