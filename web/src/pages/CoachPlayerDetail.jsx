/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { initials } from '../lib/format.js';

const TABS = ['Overview', 'Programme', 'Progress', 'Nutrition', 'Sessions', 'Notes'];

export default function CoachPlayerDetail() {
  const { id } = useParams();
  const { session } = useAuth();
  const [client, setClient] = useState(undefined); // undefined=loading, null=not found
  const [tab, setTab] = useState('Overview');

  useEffect(() => { if (session?.demo) return; (async () => {
    // Trainer can read the client's user row only if actively linked (RLS).
    const { data } = await supabase.from('users').select('id, name, email').eq('id', id).single();
    setClient(data || null);
  })(); }, [id]);

  if (session?.demo) return <AppShell role="coach" active="Clients" title="Client"><div className="card">Demo mode.</div></AppShell>;
  if (client === undefined) return <AppShell role="coach" active="Clients" title="Client"><div className="card">Loading…</div></AppShell>;
  if (client === null) return <AppShell role="coach" active="Clients" title="Client"><div className="card">Client not found, or not linked to you. <Link to="/coach/squad">Back to clients</Link></div></AppShell>;

  return (
    <AppShell role="coach" active="Clients" title={client.name}>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 12 }}>
          <span className="avatar">{initials(client.name)}</span>
          <div>
            <strong style={{ fontSize: 18 }}>{client.name}</strong>
            <div className="subtle" style={{ fontSize: 13 }}>{client.email}</div>
          </div>
        </div>
        <div className="segmented" style={{ marginTop: 14, flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <button key={t} type="button" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
      </div>

      {tab === 'Overview'  && <Overview  clientId={id} />}
      {tab === 'Programme' && <Programme clientId={id} />}
      {tab === 'Progress'  && <Progress  clientId={id} />}
      {tab === 'Nutrition' && <Nutrition clientId={id} />}
      {tab === 'Sessions'  && <Sessions  clientId={id} />}
      {tab === 'Notes'     && <Notes     clientId={id} />}
    </AppShell>
  );
}

/* ------------------------------------------------------------------ Overview */
function Overview({ clientId }) {
  const [d, setD] = useState(null);
  useEffect(() => { (async () => {
    const nowIso = new Date().toISOString();
    const [bm, prog, plan, logs, logCount, food, appt, notes] = await Promise.all([
      supabase.from('body_metrics').select('*').eq('client_id', clientId).order('metric_date', { ascending: false }).limit(30),
      supabase.from('workout_programmes').select('id, name').eq('client_id', clientId).eq('is_active', true).limit(1),
      supabase.from('nutrition_plans').select('*').eq('client_id', clientId).eq('is_active', true).limit(1),
      supabase.from('workout_logs').select('id, log_date, note, logged_sets(id)').eq('client_id', clientId).order('log_date', { ascending: false }).limit(5),
      supabase.from('workout_logs').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
      supabase.from('food_logs').select('*').eq('client_id', clientId).order('log_date', { ascending: false }).limit(1),
      supabase.from('appointments').select('*').eq('client_id', clientId).gte('starts_at', nowIso).order('starts_at', { ascending: true }).limit(1),
      supabase.from('client_notes').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(2),
    ]);

    let progInfo = null;
    if (prog.data?.[0]) {
      const p = prog.data[0];
      const [{ data: days }, { count: exCount }] = await Promise.all([
        supabase.from('programme_days').select('id').eq('programme_id', p.id),
        supabase.from('programme_exercises').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
      ]);
      progInfo = { name: p.name, days: days?.length || 0, exercises: exCount || 0 };
    }
    let mealCount = 0;
    if (plan.data?.[0]) {
      const { count } = await supabase.from('meal_plan_items').select('id', { count: 'exact', head: true }).eq('plan_id', plan.data[0].id);
      mealCount = count || 0;
    }

    setD({
      metrics: bm.data || [],
      prog: progInfo,
      plan: plan.data?.[0] || null,
      mealCount,
      logs: logs.data || [],
      logCount: logCount.count || 0,
      food: food.data?.[0] || null,
      appt: appt.data?.[0] || null,
      notes: notes.data || [],
    });
  })(); }, [clientId]);

  if (!d) return <div className="card">Loading…</div>;

  const latest = d.metrics[0];
  const chronoW = [...d.metrics].reverse().map((m) => m.weight_kg).filter((x) => x != null);
  const delta = chronoW.length > 1 ? chronoW[chronoW.length - 1] - chronoW[0] : null;
  const apptWhen = d.appt ? new Date(d.appt.starts_at).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <div className="stack">
      {/* headline stats */}
      <div className="grid grid-4">
        <div className="kpi"><div className="kpi-label">Current weight</div>
          <div className="kpi-value">{latest?.weight_kg != null ? `${latest.weight_kg}kg` : '—'}</div>
          {delta != null && <span className={`badge ${delta <= 0 ? 'badge-success' : 'badge-warning'}`}>{delta > 0 ? '+' : ''}{delta.toFixed(1)}kg</span>}</div>
        <div className="kpi"><div className="kpi-label">Body fat</div>
          <div className="kpi-value">{latest?.body_fat_pct != null ? `${latest.body_fat_pct}%` : '—'}</div></div>
        <div className="kpi"><div className="kpi-label">Sessions logged</div>
          <div className="kpi-value">{d.logCount}</div></div>
        <div className="kpi"><div className="kpi-label">Last check-in</div>
          <div className="kpi-value" style={{ fontSize: 18 }}>{latest?.metric_date || '—'}</div></div>
      </div>

      {/* weight trend */}
      {d.metrics.length > 0 && (
        <div className="card">
          <div className="section-header"><h4 style={{ margin: 0 }}>Weight trend</h4><span className="subtle" style={{ fontSize: 12 }}>last {d.metrics.length} entries</span></div>
          <Sparkline points={chronoW} />
        </div>
      )}

      <div className="grid grid-2">
        {/* programme */}
        <div className="card">
          <h4 style={{ marginTop: 0 }}>Programme</h4>
          {d.prog ? (
            <>
              <strong>{d.prog.name}</strong>
              <div className="subtle" style={{ fontSize: 13, marginTop: 4 }}>{d.prog.days} day{d.prog.days === 1 ? '' : 's'} · {d.prog.exercises} exercise{d.prog.exercises === 1 ? '' : 's'}</div>
            </>
          ) : <p className="subtle" style={{ margin: 0 }}>No active programme.</p>}
        </div>
        {/* nutrition */}
        <div className="card">
          <h4 style={{ marginTop: 0 }}>Nutrition</h4>
          {d.plan ? (
            <>
              <strong>{d.plan.daily_kcal ? `${d.plan.daily_kcal} kcal / day` : 'Targets set'}</strong>
              <div className="subtle" style={{ fontSize: 13, marginTop: 4 }}>P{d.plan.protein_g || 0} · C{d.plan.carbs_g || 0} · F{d.plan.fat_g || 0} · {d.mealCount} meal{d.mealCount === 1 ? '' : 's'}</div>
              {d.food && <div className="subtle" style={{ fontSize: 12, marginTop: 6 }}>Last logged {d.food.log_date}: {d.food.kcal ?? '—'} kcal</div>}
            </>
          ) : <p className="subtle" style={{ margin: 0 }}>No nutrition plan.</p>}
        </div>
      </div>

      {/* next session */}
      <div className="card">
        <h4 style={{ marginTop: 0 }}>Next session</h4>
        {apptWhen ? <div><strong>{apptWhen}</strong><div className="subtle" style={{ fontSize: 13 }}>{d.appt.duration_min} min{d.appt.note ? ` · ${d.appt.note}` : ''}</div></div>
         : <p className="subtle" style={{ margin: 0 }}>Nothing booked.</p>}
      </div>

      {/* recent sessions */}
      <div className="card">
        <h4 style={{ marginTop: 0 }}>Recent sessions</h4>
        {d.logs.length === 0 ? <p className="subtle" style={{ margin: 0 }}>No sessions logged yet.</p> : (
          <div className="stack" style={{ gap: 6 }}>
            {d.logs.map((l) => (
              <div key={l.id} className="row between" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px' }}>
                <div><strong>{l.log_date}</strong>{l.note && <span className="subtle" style={{ fontSize: 12 }}> · {l.note}</span>}</div>
                <span className="badge badge-neutral">{l.logged_sets?.length || 0} sets</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* latest notes */}
      {d.notes.length > 0 && (
        <div className="card">
          <h4 style={{ marginTop: 0 }}>Latest notes</h4>
          <div className="stack" style={{ gap: 6 }}>
            {d.notes.map((n) => (
              <div key={n.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px' }}>
                <div className="subtle" style={{ fontSize: 12 }}>{new Date(n.created_at).toLocaleDateString()}</div>
                <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{n.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- Programme */
function Programme({ clientId }) {
  const [prog, setProg] = useState(undefined);
  const [days, setDays] = useState([]);
  const [ex, setEx] = useState({}); // dayId -> [exercises]
  const [newProg, setNewProg] = useState('');
  const [newDay, setNewDay] = useState('');
  const [exForm, setExForm] = useState({}); // dayId -> {name,sets,reps,weight}

  async function load() {
    const { data: p } = await supabase.from('workout_programmes')
      .select('*').eq('client_id', clientId).eq('is_active', true).limit(1);
    const programme = p?.[0] || null;
    setProg(programme);
    if (!programme) { setDays([]); setEx({}); return; }
    const { data: dd } = await supabase.from('programme_days')
      .select('*').eq('programme_id', programme.id).order('sort_order');
    setDays(dd || []);
    const dayIds = (dd || []).map((x) => x.id);
    if (dayIds.length === 0) { setEx({}); return; }
    const { data: xx } = await supabase.from('programme_exercises')
      .select('*').in('day_id', dayIds).order('sort_order');
    const map = {};
    (xx || []).forEach((e) => { (map[e.day_id] ||= []).push(e); });
    setEx(map);
  }
  useEffect(() => { load(); }, [clientId]);

  async function createProgramme() {
    if (!newProg.trim()) return;
    await supabase.from('workout_programmes').insert({ client_id: clientId, name: newProg.trim(), is_active: true });
    setNewProg(''); load();
  }
  async function addDay() {
    if (!newDay.trim()) return;
    await supabase.from('programme_days').insert({ client_id: clientId, programme_id: prog.id, name: newDay.trim(), sort_order: days.length });
    setNewDay(''); load();
  }
  function exField(dayId, k, v) { setExForm((f) => ({ ...f, [dayId]: { ...(f[dayId] || {}), [k]: v } })); }
  async function addExercise(dayId) {
    const form = exForm[dayId] || {};
    if (!form.name?.trim()) return;
    await supabase.from('programme_exercises').insert({
      client_id: clientId, day_id: dayId, name: form.name.trim(),
      target_sets: form.sets ? parseInt(form.sets, 10) : null,
      target_reps: form.reps || null,
      target_weight: form.weight ? parseFloat(form.weight) : null,
      sort_order: (ex[dayId]?.length || 0),
    });
    setExForm((f) => ({ ...f, [dayId]: {} }));
    load();
  }
  async function delExercise(id) { await supabase.from('programme_exercises').delete().eq('id', id); load(); }
  async function delDay(id) { await supabase.from('programme_days').delete().eq('id', id); load(); }

  if (prog === undefined) return <div className="card">Loading…</div>;
  if (!prog) return (
    <div className="card">
      <h4 style={{ marginTop: 0 }}>Create a programme</h4>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <input className="input" style={{ flex: 1, minWidth: 220 }} placeholder='e.g. "Push / Pull / Legs" or "Week 1"'
          value={newProg} onChange={(e) => setNewProg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createProgramme()} />
        <button className="btn btn-primary" disabled={!newProg.trim()} onClick={createProgramme}>Create</button>
      </div>
    </div>
  );

  return (
    <div className="stack">
      <div className="card">
        <h4 style={{ marginTop: 0 }}>{prog.name}</h4>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input className="input" style={{ flex: 1, minWidth: 180 }} placeholder='Add a day (e.g. "Push", "Legs", or "Week")'
            value={newDay} onChange={(e) => setNewDay(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addDay()} />
          <button className="btn btn-secondary" disabled={!newDay.trim()} onClick={addDay}>+ Add day</button>
        </div>
        {days.length === 0 && <p className="subtle" style={{ margin: '10px 0 0' }}>Add a day to start. A simple weekly plan can be one day called “Week”.</p>}
      </div>

      {days.map((day) => (
        <div className="card" key={day.id}>
          <div className="section-header">
            <h4 style={{ margin: 0 }}>{day.name}</h4>
            <button className="btn btn-ghost" style={{ minHeight: 30 }} onClick={() => delDay(day.id)}>Delete day</button>
          </div>
          {(ex[day.id] || []).length > 0 && (
            <div className="stack" style={{ gap: 6, marginBottom: 10 }}>
              {(ex[day.id] || []).map((e) => (
                <div key={e.id} className="row between" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px' }}>
                  <div><strong>{e.name}</strong>
                    <div className="subtle" style={{ fontSize: 12 }}>
                      {e.target_sets ? `${e.target_sets}×` : ''}{e.target_reps || ''}{e.target_weight ? ` @ ${e.target_weight}kg` : ''}
                    </div>
                  </div>
                  <button className="btn btn-ghost" style={{ minHeight: 28 }} onClick={() => delExercise(e.id)}>✕</button>
                </div>
              ))}
            </div>
          )}
          {/* inline add-exercise row — no popups */}
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <input className="input" style={{ flex: 2, minWidth: 140 }} placeholder="Exercise"
              value={exForm[day.id]?.name || ''} onChange={(e) => exField(day.id, 'name', e.target.value)} />
            <input className="input" style={{ width: 70 }} type="number" placeholder="sets"
              value={exForm[day.id]?.sets || ''} onChange={(e) => exField(day.id, 'sets', e.target.value)} />
            <input className="input" style={{ width: 92 }} placeholder="reps"
              value={exForm[day.id]?.reps || ''} onChange={(e) => exField(day.id, 'reps', e.target.value)} />
            <input className="input" style={{ width: 78 }} type="number" placeholder="kg"
              value={exForm[day.id]?.weight || ''} onChange={(e) => exField(day.id, 'weight', e.target.value)} />
            <button className="btn btn-secondary" style={{ minHeight: 40 }} disabled={!exForm[day.id]?.name?.trim()} onClick={() => addExercise(day.id)}>Add</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ Progress */
function Progress({ clientId }) {
  const [rows, setRows] = useState(null);
  const [w, setW] = useState('');
  const [bf, setBf] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase.from('body_metrics')
      .select('*').eq('client_id', clientId).order('metric_date', { ascending: false }).limit(60);
    setRows(data || []);
  }
  useEffect(() => { load(); }, [clientId]);

  async function add(e) {
    e.preventDefault();
    if (!w) return;
    setBusy(true);
    try {
      await supabase.from('body_metrics').upsert({
        client_id: clientId, metric_date: new Date().toISOString().slice(0, 10),
        weight_kg: parseFloat(w), body_fat_pct: bf ? parseFloat(bf) : null,
      }, { onConflict: 'client_id,metric_date' });
      setW(''); setBf(''); load();
    } finally { setBusy(false); }
  }

  const chrono = rows ? [...rows].reverse() : [];
  const first = chrono[0]?.weight_kg, last = chrono[chrono.length - 1]?.weight_kg;
  const delta = (first != null && last != null) ? (last - first) : null;

  return (
    <div className="stack">
      <div className="card">
        <div className="section-header"><h4 style={{ margin: 0 }}>Body weight</h4>
          {delta != null && <span className={`badge ${delta <= 0 ? 'badge-success' : 'badge-warning'}`}>{delta > 0 ? '+' : ''}{delta.toFixed(1)}kg</span>}</div>
        <Sparkline points={chrono.map((r) => r.weight_kg).filter((x) => x != null)} />
        <form onSubmit={add} className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <input className="input" style={{ maxWidth: 130 }} type="number" step="0.1" placeholder="Weight kg" value={w} onChange={(e) => setW(e.target.value)} />
          <input className="input" style={{ maxWidth: 130 }} type="number" step="0.1" placeholder="Body fat %" value={bf} onChange={(e) => setBf(e.target.value)} />
          <button className="btn btn-primary" disabled={busy || !w}>Log today</button>
        </form>
      </div>
      <div className="card">
        <h4 style={{ marginTop: 0 }}>History</h4>
        {rows === null ? <p className="subtle">Loading…</p>
         : rows.length === 0 ? <p className="subtle" style={{ margin: 0 }}>No measurements yet.</p>
         : (
          <table className="table"><thead><tr><th>Date</th><th>Weight</th><th>Body fat</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.id}><td>{r.metric_date}</td><td>{r.weight_kg != null ? `${r.weight_kg}kg` : '—'}</td><td>{r.body_fat_pct != null ? `${r.body_fat_pct}%` : '—'}</td></tr>)}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Sparkline({ points }) {
  if (!points || points.length < 2) return <p className="subtle" style={{ fontSize: 12, margin: 0 }}>Log at least two entries to see a trend.</p>;
  const w = 300, h = 60, min = Math.min(...points), max = Math.max(...points), range = max - min || 1;
  const step = w / (points.length - 1);
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(1)} ${(h - ((p - min) / range) * h).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 60 }} preserveAspectRatio="none">
      <path d={d} fill="none" stroke="var(--green-600)" strokeWidth="2" />
    </svg>
  );
}

/* ----------------------------------------------------------------- Nutrition */
function Nutrition({ clientId }) {
  const [plan, setPlan] = useState(undefined);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ daily_kcal: '', protein_g: '', carbs_g: '', fat_g: '' });
  const [meal, setMeal] = useState({ meal: '', description: '', kcal: '' });
  const [savedMsg, setSavedMsg] = useState('');

  async function load() {
    const { data: p } = await supabase.from('nutrition_plans')
      .select('*').eq('client_id', clientId).eq('is_active', true).limit(1);
    const pl = p?.[0] || null;
    setPlan(pl);
    setForm({ daily_kcal: pl?.daily_kcal ?? '', protein_g: pl?.protein_g ?? '', carbs_g: pl?.carbs_g ?? '', fat_g: pl?.fat_g ?? '' });
    if (pl) {
      const { data: mi } = await supabase.from('meal_plan_items').select('*').eq('plan_id', pl.id).order('sort_order');
      setItems(mi || []);
    } else setItems([]);
  }
  useEffect(() => { load(); }, [clientId]);

  async function saveTargets(e) {
    e.preventDefault();
    const payload = {
      client_id: clientId, is_active: true,
      daily_kcal: form.daily_kcal ? parseInt(form.daily_kcal, 10) : null,
      protein_g: form.protein_g ? parseInt(form.protein_g, 10) : null,
      carbs_g: form.carbs_g ? parseInt(form.carbs_g, 10) : null,
      fat_g: form.fat_g ? parseInt(form.fat_g, 10) : null,
    };
    if (plan) await supabase.from('nutrition_plans').update(payload).eq('id', plan.id);
    else await supabase.from('nutrition_plans').insert(payload);
    setSavedMsg('Targets saved.'); setTimeout(() => setSavedMsg(''), 2000);
    load();
  }
  async function addMeal() {
    if (!plan) { setSavedMsg('Save daily targets first.'); return; }
    if (!meal.meal.trim()) return;
    await supabase.from('meal_plan_items').insert({
      client_id: clientId, plan_id: plan.id, meal: meal.meal.trim(),
      description: meal.description.trim() || null,
      kcal: meal.kcal ? parseInt(meal.kcal, 10) : null, sort_order: items.length,
    });
    setMeal({ meal: '', description: '', kcal: '' });
    load();
  }
  async function delMeal(id) { await supabase.from('meal_plan_items').delete().eq('id', id); load(); }

  if (plan === undefined) return <div className="card">Loading…</div>;
  return (
    <div className="stack">
      <div className="card">
        <h4 style={{ marginTop: 0 }}>Daily macro targets</h4>
        <form onSubmit={saveTargets} className="grid grid-4" style={{ gap: 10 }}>
          {[['daily_kcal', 'Calories'], ['protein_g', 'Protein g'], ['carbs_g', 'Carbs g'], ['fat_g', 'Fat g']].map(([k, label]) => (
            <div className="field" key={k} style={{ margin: 0 }}>
              <label className="label">{label}</label>
              <input className="input" type="number" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </div>
          ))}
          <button className="btn btn-primary" style={{ gridColumn: '1 / -1' }}>Save targets</button>
        </form>
        {savedMsg && <p style={{ color: 'var(--success)', fontSize: 13, margin: '10px 0 0' }}>{savedMsg}</p>}
      </div>

      <div className="card">
        <h4 style={{ marginTop: 0 }}>Meal plan</h4>
        {items.length > 0 && (
          <div className="stack" style={{ gap: 6, marginBottom: 10 }}>
            {items.map((m) => (
              <div key={m.id} className="row between" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px' }}>
                <div><strong>{m.meal}</strong> <span className="subtle">{m.description}</span>
                  {m.kcal != null && <div className="subtle" style={{ fontSize: 12 }}>{m.kcal} kcal</div>}</div>
                <button className="btn btn-ghost" style={{ minHeight: 28 }} onClick={() => delMeal(m.id)}>✕</button>
              </div>
            ))}
          </div>
        )}
        {/* inline add-meal row — no popups */}
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <input className="input" style={{ width: 130 }} placeholder="Meal (Breakfast)"
            value={meal.meal} onChange={(e) => setMeal({ ...meal, meal: e.target.value })} />
          <input className="input" style={{ flex: 1, minWidth: 160 }} placeholder="What to eat"
            value={meal.description} onChange={(e) => setMeal({ ...meal, description: e.target.value })} />
          <input className="input" style={{ width: 90 }} type="number" placeholder="kcal"
            value={meal.kcal} onChange={(e) => setMeal({ ...meal, kcal: e.target.value })} />
          <button className="btn btn-secondary" style={{ minHeight: 40 }} disabled={!meal.meal.trim()} onClick={addMeal}>Add</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Sessions */
function Sessions({ clientId }) {
  const [logs, setLogs] = useState(null);
  useEffect(() => { (async () => {
    const { data } = await supabase.from('workout_logs')
      .select('id, log_date, note, logged_sets ( id, exercise_name, set_number, weight, reps )')
      .eq('client_id', clientId).order('log_date', { ascending: false }).limit(30);
    setLogs(data || []);
  })(); }, [clientId]);

  if (logs === null) return <div className="card">Loading…</div>;
  if (logs.length === 0) return <div className="card"><p className="subtle" style={{ margin: 0 }}>No sessions logged yet. Your client logs their workouts and they appear here.</p></div>;

  return (
    <div className="stack">
      {logs.map((l) => (
        <div className="card" key={l.id}>
          <div className="section-header"><h4 style={{ margin: 0 }}>{l.log_date}</h4>
            <span className="badge badge-neutral">{l.logged_sets?.length || 0} sets</span></div>
          {l.note && <p className="subtle" style={{ marginTop: 0 }}>{l.note}</p>}
          {(l.logged_sets || []).length > 0 && (
            <table className="table"><thead><tr><th>Exercise</th><th>Set</th><th>Weight</th><th>Reps</th></tr></thead>
              <tbody>{[...l.logged_sets].sort((a, b) => a.set_number - b.set_number).map((s) => (
                <tr key={s.id}><td>{s.exercise_name}</td><td>{s.set_number}</td><td>{s.weight != null ? `${s.weight}kg` : '—'}</td><td>{s.reps ?? '—'}</td></tr>
              ))}</tbody></table>
          )}
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------------- Notes */
function Notes({ clientId }) {
  const { profile } = useAuth();
  const [notes, setNotes] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase.from('client_notes')
      .select('*').eq('client_id', clientId).order('created_at', { ascending: false });
    setNotes(data || []);
  }
  useEffect(() => { load(); }, [clientId]);

  async function add(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await supabase.from('client_notes').insert({ trainer_id: profile.id, client_id: clientId, note: text.trim() });
      setText(''); load();
    } finally { setBusy(false); }
  }
  async function del(id) { await supabase.from('client_notes').delete().eq('id', id); load(); }

  return (
    <div className="stack">
      <div className="card">
        <h4 style={{ marginTop: 0 }}>Add a note</h4>
        <form onSubmit={add}>
          <textarea className="textarea" placeholder="Private note about this client…" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn btn-primary" style={{ marginTop: 8 }} disabled={busy || !text.trim()}>Save note</button>
        </form>
      </div>
      {notes === null ? <div className="card">Loading…</div>
       : notes.length === 0 ? <div className="card"><p className="subtle" style={{ margin: 0 }}>No notes yet.</p></div>
       : notes.map((n) => (
        <div className="card" key={n.id}>
          <div className="row between">
            <span className="subtle" style={{ fontSize: 12 }}>{new Date(n.created_at).toLocaleDateString()}</span>
            <button className="btn btn-ghost" style={{ minHeight: 26 }} onClick={() => del(n.id)}>Delete</button>
          </div>
          <p style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{n.note}</p>
        </div>
      ))}
    </div>
  );
}
