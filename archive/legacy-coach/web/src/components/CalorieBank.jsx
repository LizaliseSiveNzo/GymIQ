/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { ACTIVITY, METS, computeTargets, exerciseKcal, monthlyAllowance, daysInMonth } from '../lib/calorieBank.js';

const inMonth = (iso, d = new Date()) => {
  const t = new Date(iso);
  return t.getFullYear() === d.getFullYear() && t.getMonth() === d.getMonth();
};
const fmt = (n) => (n < 0 ? '−' : '') + Math.abs(Math.round(n)).toLocaleString();

// The Calorie Bank: a running account of calories. Monthly allowance is deposited,
// food withdraws, exercise deposits. Balance rolls over month to month.
export default function CalorieBank({ clientId }) {
  const [settings, setSettings] = useState(undefined); // undefined=loading, null=none
  const [txns, setTxns] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ sex: 'male', age: '', height_cm: '', weight_kg: '', goal_weight_kg: '', activity_level: 'moderate', rate_kg_per_week: '0.5' });
  const [food, setFood] = useState({ label: '', kcal: '' });
  const [ex, setEx] = useState({ activity: 'Running', minutes: '', kcal: '' });
  const [metrics, setMetrics] = useState([]);
  const [logs, setLogs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [totalBalance, setTotalBalance] = useState(0);
  const [monthSummary, setMonthSummary] = useState({ deposited: 0, spent: 0, earned: 0 });
  const [weighIn, setWeighIn] = useState('');

  async function load() {
    setError('');
    try {
    const { data: s, error: settingsError } = await supabase.from('calorie_bank').select('*').eq('user_id', clientId).maybeSingle();
    if (settingsError) throw settingsError;
    setSettings(s || null);
    if (s) {
      setForm({ sex: s.sex || 'male', age: s.age ?? '', height_cm: s.height_cm ?? '', weight_kg: s.weight_kg ?? '',
        goal_weight_kg: s.goal_weight_kg ?? '', activity_level: s.activity_level || 'moderate', rate_kg_per_week: s.rate_kg_per_week ?? '0.5' });
      const deposit = await supabase.rpc('ensure_month_deposit', { uid: clientId });
      if (deposit.error) throw deposit.error;
    }
    const { data: t } = await supabase.from('calorie_transactions').select('*').eq('user_id', clientId).order('occurred_at', { ascending: false }).limit(100);
    setTxns(t || []);
    const result = await supabase.rpc('calorie_bank_summary');
    if (result.error) throw result.error;
    setTotalBalance(Number(result.data.balance) || 0);
    setMonthSummary(result.data);
    const since = new Date(Date.now() - 40 * 864e5).toISOString().slice(0, 10);
    const [{ data: bm }, { data: wl }] = await Promise.all([
      supabase.from('body_metrics').select('metric_date, weight_kg').eq('client_id', clientId).gte('metric_date', since).order('metric_date'),
      supabase.from('workout_logs').select('log_date').eq('client_id', clientId).not('completed_at', 'is', null).gte('log_date', since),
    ]);
    setMetrics(bm || []); setLogs(wl || []);
    } catch (e) { setError(e.message || 'Could not load your bank. Please try again.'); }
  }
  useEffect(() => { load(); }, [clientId]);

  const preview = useMemo(() => computeTargets(form), [form]);

  const balance = totalBalance;
  const month = monthSummary;
  const insights = useMemo(() => {
    const weights = metrics.filter((m) => m.weight_kg != null);
    const series = weights.slice(-7).map((m) => Number(m.weight_kg));
    const latestW = series.length ? series[series.length - 1] : null;
    const dayKey = (d) => d.toISOString().slice(0, 10);
    const today = new Date();
    const last7 = [...Array(7)].map((_, i) => dayKey(new Date(today - (6 - i) * 864e5)));
    const logDates = logs.map((l) => l.log_date);
    const weekBars = last7.map((d) => logDates.filter((x) => x === d).length);
    const workoutsWeek = weekBars.reduce((a, b) => a + b, 0);
    const metricDays = new Set(metrics.map((m) => m.metric_date));
    const grid = [...Array(35)].map((_, i) => metricDays.has(dayKey(new Date(today - (34 - i) * 864e5))));
    const weighWeek = last7.filter((d) => metricDays.has(d)).length;
    return { series, latestW, weekBars, workoutsWeek, grid, weighWeek };
  }, [metrics, logs]);

  async function saveSettings(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const { bmr, tdee, dailyTarget } = computeTargets(form);
      const payload = {
        user_id: clientId, sex: form.sex, age: form.age ? parseInt(form.age, 10) : null,
        height_cm: form.height_cm ? parseFloat(form.height_cm) : null,
        weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
        goal_weight_kg: form.goal_weight_kg ? parseFloat(form.goal_weight_kg) : null,
        activity_level: form.activity_level, rate_kg_per_week: parseFloat(form.rate_kg_per_week || '0'),
        bmr, tdee, daily_target: dailyTarget, updated_at: new Date().toISOString(),
      };
      const saved = await supabase.from('calorie_bank').upsert(payload, { onConflict: 'user_id' });
      if (saved.error) throw saved.error;
      const deposited = await supabase.rpc('ensure_month_deposit', { uid: clientId });
      if (deposited.error) throw deposited.error;
      setEditing(false); await load();
    } catch (e) { setError(e.message || 'Could not save your settings.');
    } finally { setBusy(false); }
  }

  async function addFood() {
    if (busy) return;
    const k = parseInt(food.kcal, 10);
    if (!k || k <= 0) return;
    setBusy(true);
    const { error } = await supabase.from('calorie_transactions').insert({ user_id: clientId, kind: 'food', kcal: -Math.abs(k), label: food.label.trim() || 'Food' });
    if (error) setError(error.message);
    else { setFood({ label: '', kcal: '' }); await load(); }
    setBusy(false);
  }
  async function addExercise() {
    if (busy) return;
    let k = ex.kcal ? parseInt(ex.kcal, 10) : exerciseKcal(ex.activity, ex.minutes, settings?.weight_kg);
    if (!k || k <= 0) return;
    const label = ex.kcal && !ex.minutes ? (ex.activity || 'Exercise') : `${ex.activity}${ex.minutes ? ` · ${ex.minutes} min` : ''}`;
    setBusy(true);
    const { error } = await supabase.from('calorie_transactions').insert({ user_id: clientId, kind: 'exercise', kcal: Math.abs(k), label });
    if (error) setError(error.message);
    else { setEx({ activity: 'Running', minutes: '', kcal: '' }); await load(); }
    setBusy(false);
  }
  async function delTxn(id) { const { error } = await supabase.from('calorie_transactions').delete().eq('id', id); if (error) setError(error.message); else await load(); }
  async function logWeight(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const day = new Date();
      const metric_date = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
      const { error } = await supabase.from('body_metrics').upsert({ client_id: clientId, metric_date, weight_kg: Number(weighIn) }, { onConflict: 'client_id,metric_date' });
      if (error) throw error;
      setWeighIn(''); await load();
    } catch (e) { setError(e.message || 'Could not save your weight.'); }
    finally { setBusy(false); }
  }

  if (error) return <div className="inline-error" role="alert">{error}<button className="btn btn-secondary" onClick={load}>Try again</button></div>;
  if (settings === undefined) return <div className="card" role="status">Loading your bank…</div>;

  // ---- Setup / edit form ----
  if (settings === null || editing) {
    const goal = parseFloat(form.goal_weight_kg), w = parseFloat(form.weight_kg);
    const dir = !goal || !w ? '' : goal < w ? 'lose weight' : goal > w ? 'gain weight' : 'maintain';
    return (
      <div className="stack calorie-bank">
        <div className="card">
          <h4 style={{ marginTop: 0 }}>{settings ? 'Edit your Calorie Bank' : 'Set up your Calorie Bank'}</h4>
          <p className="subtle" style={{ fontSize: 13, marginTop: 0 }}>Enter your details and goal. We work out how many calories you can bank each month.</p>
          <form onSubmit={saveSettings}>
            <div className="grid grid-2" style={{ gap: 10 }}>
              <div className="field" style={{ margin: 0 }}><label className="label">Sex</label>
                <select className="select" aria-label="Sex" value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}>
                  <option value="male">Male</option><option value="female">Female</option>
                </select></div>
              <div className="field" style={{ margin: 0 }}><label className="label">Age</label>
                <input className="input" type="number" aria-label="Age" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} /></div>
              <div className="field" style={{ margin: 0 }}><label className="label">Height (cm)</label>
                <input className="input" type="number" aria-label="Height in centimetres" value={form.height_cm} onChange={(e) => setForm({ ...form, height_cm: e.target.value })} /></div>
              <div className="field" style={{ margin: 0 }}><label className="label">Current weight (kg)</label>
                <input className="input" type="number" step="0.1" aria-label="Current weight in kilograms" value={form.weight_kg} onChange={(e) => setForm({ ...form, weight_kg: e.target.value })} /></div>
              <div className="field" style={{ margin: 0 }}><label className="label">Goal weight (kg)</label>
                <input className="input" type="number" step="0.1" aria-label="Goal weight in kilograms" value={form.goal_weight_kg} onChange={(e) => setForm({ ...form, goal_weight_kg: e.target.value })} /></div>
              <div className="field" style={{ margin: 0 }}><label className="label">Pace (kg / week)</label>
                <select className="select" aria-label="Weekly rate" value={form.rate_kg_per_week} onChange={(e) => setForm({ ...form, rate_kg_per_week: e.target.value })}>
                  <option value="0.25">0.25 — gentle</option><option value="0.5">0.5 — standard</option><option value="0.75">0.75 — aggressive</option><option value="1">1.0 — very aggressive</option>
                </select></div>
            </div>
            <div className="field" style={{ marginBottom: 0, marginTop: 10 }}><label className="label">Activity level</label>
              <select className="select" aria-label="Activity level" value={form.activity_level} onChange={(e) => setForm({ ...form, activity_level: e.target.value })}>
                {ACTIVITY.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
              </select></div>

            {preview.dailyTarget && (
              <div className="card" style={{ marginTop: 14, background: 'var(--surface-2, rgba(255,255,255,.03))' }}>
                <div className="row between"><span className="subtle">Daily allowance</span><strong>{fmt(preview.dailyTarget)} kcal</strong></div>
                <div className="row between"><span className="subtle">Monthly deposit ({daysInMonth()} days)</span><strong style={{ color: 'var(--green-600)' }}>{fmt(monthlyAllowance(preview.dailyTarget))} kcal</strong></div>
                <div className="subtle" style={{ fontSize: 12, marginTop: 6 }}>Based on BMR {fmt(preview.bmr)} · TDEE {fmt(preview.tdee)}{dir ? ` · goal: ${dir}` : ''}.</div>
              </div>
            )}
            <div className="row" style={{ gap: 8, marginTop: 14 }}>
              <button className="btn btn-primary" disabled={busy || !preview.dailyTarget}>{settings ? 'Save changes' : 'Open my bank'}</button>
              {settings && <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>}
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ---- Bank dashboard ----
  const allowance = monthlyAllowance(settings.daily_target);
  const overdrawn = balance <= 0;
  const frac = allowance > 0 ? Math.max(0, Math.min(1, balance / allowance)) : 0;
  const low = !overdrawn && frac < 0.15;
  const ringColor = overdrawn ? 'var(--danger)' : low ? 'var(--warning)' : 'var(--green-600)';
  const R = 96, C = 2 * Math.PI * R;
  const off = C * (1 - (overdrawn ? 1 : frac));
  return (
    <div className="stack calorie-bank">
      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ position: 'relative', width: 220, height: 220, margin: '2px auto 0' }}>
          <svg width="220" height="220" viewBox="0 0 220 220">
            <circle cx="110" cy="110" r={R} fill="none" stroke="var(--border)" strokeWidth="16" />
            <circle cx="110" cy="110" r={R} fill="none" stroke={ringColor} strokeWidth="16" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={off} transform="rotate(-90 110 110)"
              style={{ transition: 'stroke-dashoffset .6s ease, stroke .3s' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 42, fontWeight: 800, lineHeight: 1, color: ringColor }}>{fmt(balance)}</div>
            <div className="subtle" style={{ fontSize: 12, marginTop: 4 }}>kcal {overdrawn ? 'over budget' : 'available'}</div>
            <div className="subtle" style={{ fontSize: 11, marginTop: 2 }}>of {fmt(allowance)} this month</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 14 }}>
          <div className="kpi" style={{ padding: 12 }}><div className="kpi-label">Deposited</div><div className="kpi-value" style={{ fontSize: 18 }}>{fmt(month.deposited)}</div></div>
          <div className="kpi" style={{ padding: 12 }}><div className="kpi-label">Eaten</div><div className="kpi-value" style={{ fontSize: 18 }}>{fmt(month.spent)}</div></div>
          <div className="kpi" style={{ padding: 12 }}><div className="kpi-label">Earned</div><div className="kpi-value" style={{ fontSize: 18, color: 'var(--green-600)' }}>+{fmt(month.earned)}</div></div>
        </div>
        <div className="subtle" style={{ fontSize: 12, marginTop: 10 }}>
          Monthly allowance {fmt(allowance)} kcal ({fmt(settings.daily_target)}/day) · goal {settings.goal_weight_kg}kg
          <button className="btn btn-ghost" style={{ minHeight: 24, padding: '0 8px', marginLeft: 8 }} onClick={() => setEditing(true)}>Edit</button>
        </div>
      </div>

      <form className="mf-card" onSubmit={logWeight}><label htmlFor="bank-weight" className="label">Today’s weigh-in</label><div className="row" style={{ gap: 10 }}><input id="bank-weight" className="input" type="number" inputMode="decimal" min="25" max="500" step="0.1" required placeholder="Weight in kg" value={weighIn} onChange={e => setWeighIn(e.target.value)} style={{ flex: 1 }} /><button className="btn btn-secondary" disabled={busy}>Save weight</button></div></form>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        <div className="card" style={{ padding: 14 }}>
          <strong style={{ fontSize: 14 }}>Weight trend</strong>
          <div className="subtle" style={{ fontSize: 11 }}>Last 7 entries</div>
          <Spark points={insights.series} />
          <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>{insights.latestW != null ? insights.latestW : '—'}<span className="subtle" style={{ fontSize: 12 }}> kg</span></div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <strong style={{ fontSize: 14 }}>Workouts</strong>
          <div className="subtle" style={{ fontSize: 11 }}>This week</div>
          <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end', height: 34, marginTop: 8 }}>
            {insights.weekBars.map((n, i) => (
              <div key={i} style={{ flex: 1, height: `${n ? 30 + n * 34 : 12}%`, background: n ? 'var(--green-600)' : 'var(--surface-2)', borderRadius: 3 }} />
            ))}
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, marginTop: 6 }}>{insights.workoutsWeek}<span className="subtle" style={{ fontSize: 12 }}> session{insights.workoutsWeek === 1 ? '' : 's'}</span></div>
        </div>
      </div>

      <div className="card" style={{ padding: 14 }}>
        <strong style={{ fontSize: 14 }}>Weigh-in streak</strong>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(18, 1fr)', gap: 4, marginTop: 10 }}>
          {insights.grid.map((on, i) => (
            <div key={i} style={{ aspectRatio: '1', borderRadius: 3, background: on ? 'var(--green-600)' : 'var(--surface-2)' }} />
          ))}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, marginTop: 10 }}>{insights.weighWeek}<span className="subtle" style={{ fontWeight: 400 }}> / 7 this week</span></div>
      </div>

      <div className="bank-log-grid">
        <div className="card">
          <h4 style={{ marginTop: 0 }}>🍽️ Log food</h4>
          <div className="subtle" style={{ fontSize: 12, marginBottom: 8 }}>Withdraws from your bank.</div>
          <input className="input" aria-label="Food description" placeholder="What did you eat?" value={food.label} onChange={(e) => setFood({ ...food, label: e.target.value })} style={{ marginBottom: 8 }} />
          <div className="row" style={{ gap: 8 }}>
            <input className="input" type="number" aria-label="Food calories" placeholder="kcal" value={food.kcal} onChange={(e) => setFood({ ...food, kcal: e.target.value })} style={{ flex: 1 }} />
            <button className="btn btn-secondary" disabled={busy || !food.kcal} onClick={addFood}>Subtract</button>
          </div>
        </div>
        <div className="card">
          <h4 style={{ marginTop: 0 }}>🏃 Log exercise</h4>
          <div className="subtle" style={{ fontSize: 12, marginBottom: 8 }}>Adds calories to your bank.</div>
          <div className="row" style={{ gap: 8, marginBottom: 8 }}>
            <select className="select" aria-label="Exercise activity" value={ex.activity} onChange={(e) => setEx({ ...ex, activity: e.target.value })} style={{ flex: 1 }}>
              {METS.map((m) => <option key={m.key} value={m.key}>{m.key}</option>)}
            </select>
            <input className="input" type="number" placeholder="min" aria-label="Exercise duration in minutes" value={ex.minutes} onChange={(e) => setEx({ ...ex, minutes: e.target.value })} style={{ width: 80 }} />
          </div>
          <div className="row" style={{ gap: 8 }}>
            <input className="input" type="number" placeholder="or kcal directly" aria-label="Exercise calories" value={ex.kcal} onChange={(e) => setEx({ ...ex, kcal: e.target.value })} style={{ flex: 1 }} />
            <button className="btn btn-secondary" disabled={busy || (!ex.minutes && !ex.kcal)} onClick={addExercise}>Add</button>
          </div>
          {ex.minutes && settings.weight_kg && !ex.kcal && (
            <div className="subtle" style={{ fontSize: 12, marginTop: 6 }}>≈ {fmt(exerciseKcal(ex.activity, ex.minutes, settings.weight_kg))} kcal</div>
          )}
        </div>
      </div>

      <div className="card">
        <h4 style={{ marginTop: 0 }}>Recent transactions</h4>
        {txns.length === 0 ? <p className="subtle" style={{ margin: 0 }}>No transactions yet.</p> : (
          <div className="stack" style={{ gap: 6 }}>
            {txns.slice(0, 40).map((t) => {
              const pos = t.kcal >= 0;
              const icon = t.kind === 'deposit' ? '💰' : t.kind === 'exercise' ? '🏃' : t.kind === 'food' ? '🍽️' : '⚙️';
              return (
                <div key={t.id} className="row between" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px' }}>
                  <div><strong>{icon} {t.label || t.kind}</strong>
                    <div className="subtle" style={{ fontSize: 12 }}>{new Date(t.occurred_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</div></div>
                  <div className="row" style={{ gap: 8 }}>
                    <span style={{ fontWeight: 700, color: pos ? 'var(--green-600)' : 'var(--danger)' }}>{pos ? '+' : '−'}{Math.abs(t.kcal).toLocaleString()}</span>
                    <button className="btn btn-ghost" style={{ minHeight: 24, padding: '0 8px' }} aria-label={`Delete ${t.label || t.kind} transaction`} onClick={() => delTxn(t.id)}>✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Tiny inline sparkline for the weight-trend card.
function Spark({ points }) {
  if (!points || points.length < 2) return <div style={{ height: 34, marginTop: 8, display: 'flex', alignItems: 'center' }}><span className="subtle" style={{ fontSize: 11 }}>Log 2+ weigh-ins</span></div>;
  const w = 120, h = 34, min = Math.min(...points), max = Math.max(...points), range = max - min || 1;
  const step = w / (points.length - 1);
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(1)} ${(h - ((p - min) / range) * (h - 4) - 2).toFixed(1)}`).join(' ');
  return (
    <svg width="100%" height="34" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ marginTop: 8 }}>
      <path d={d} fill="none" stroke="var(--info)" strokeWidth="2.5" />
    </svg>
  );
}
