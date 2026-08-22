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
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data: s } = await supabase.from('calorie_bank').select('*').eq('user_id', clientId).maybeSingle();
    setSettings(s || null);
    if (s) {
      setForm({ sex: s.sex || 'male', age: s.age ?? '', height_cm: s.height_cm ?? '', weight_kg: s.weight_kg ?? '',
        goal_weight_kg: s.goal_weight_kg ?? '', activity_level: s.activity_level || 'moderate', rate_kg_per_week: s.rate_kg_per_week ?? '0.5' });
      await supabase.rpc('ensure_month_deposit', { uid: clientId });
    }
    const { data: t } = await supabase.from('calorie_transactions').select('*').eq('user_id', clientId).order('occurred_at', { ascending: false }).limit(100);
    setTxns(t || []);
  }
  useEffect(() => { load(); }, [clientId]);

  const preview = useMemo(() => computeTargets(form), [form]);

  const balance = useMemo(() => txns.reduce((a, t) => a + t.kcal, 0), [txns]);
  const month = useMemo(() => {
    const m = txns.filter((t) => inMonth(t.occurred_at));
    const deposited = m.filter((t) => t.kind === 'deposit').reduce((a, t) => a + t.kcal, 0);
    const spent = m.filter((t) => t.kind === 'food').reduce((a, t) => a + Math.abs(t.kcal), 0);
    const earned = m.filter((t) => t.kind === 'exercise').reduce((a, t) => a + t.kcal, 0);
    return { deposited, spent, earned };
  }, [txns]);

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
      await supabase.from('calorie_bank').upsert(payload, { onConflict: 'user_id' });
      await supabase.rpc('ensure_month_deposit', { uid: clientId });
      setEditing(false); await load();
    } finally { setBusy(false); }
  }

  async function addFood() {
    const k = parseInt(ex ? food.kcal : food.kcal, 10);
    if (!k || k <= 0) return;
    await supabase.from('calorie_transactions').insert({ user_id: clientId, kind: 'food', kcal: -Math.abs(k), label: food.label.trim() || 'Food' });
    setFood({ label: '', kcal: '' }); load();
  }
  async function addExercise() {
    let k = ex.kcal ? parseInt(ex.kcal, 10) : exerciseKcal(ex.activity, ex.minutes, settings?.weight_kg);
    if (!k || k <= 0) return;
    const label = ex.kcal && !ex.minutes ? (ex.activity || 'Exercise') : `${ex.activity}${ex.minutes ? ` · ${ex.minutes} min` : ''}`;
    await supabase.from('calorie_transactions').insert({ user_id: clientId, kind: 'exercise', kcal: Math.abs(k), label });
    setEx({ activity: 'Running', minutes: '', kcal: '' }); load();
  }
  async function delTxn(id) { await supabase.from('calorie_transactions').delete().eq('id', id); load(); }

  if (settings === undefined) return <div className="card">Loading…</div>;

  // ---- Setup / edit form ----
  if (settings === null || editing) {
    const goal = parseFloat(form.goal_weight_kg), w = parseFloat(form.weight_kg);
    const dir = !goal || !w ? '' : goal < w ? 'lose weight' : goal > w ? 'gain weight' : 'maintain';
    return (
      <div className="stack">
        <div className="card">
          <h4 style={{ marginTop: 0 }}>{settings ? 'Edit your Calorie Bank' : 'Set up your Calorie Bank'}</h4>
          <p className="subtle" style={{ fontSize: 13, marginTop: 0 }}>Enter your details and goal. We work out how many calories you can bank each month.</p>
          <form onSubmit={saveSettings}>
            <div className="grid grid-2" style={{ gap: 10 }}>
              <div className="field" style={{ margin: 0 }}><label className="label">Sex</label>
                <select className="select" value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}>
                  <option value="male">Male</option><option value="female">Female</option>
                </select></div>
              <div className="field" style={{ margin: 0 }}><label className="label">Age</label>
                <input className="input" type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} /></div>
              <div className="field" style={{ margin: 0 }}><label className="label">Height (cm)</label>
                <input className="input" type="number" value={form.height_cm} onChange={(e) => setForm({ ...form, height_cm: e.target.value })} /></div>
              <div className="field" style={{ margin: 0 }}><label className="label">Current weight (kg)</label>
                <input className="input" type="number" step="0.1" value={form.weight_kg} onChange={(e) => setForm({ ...form, weight_kg: e.target.value })} /></div>
              <div className="field" style={{ margin: 0 }}><label className="label">Goal weight (kg)</label>
                <input className="input" type="number" step="0.1" value={form.goal_weight_kg} onChange={(e) => setForm({ ...form, goal_weight_kg: e.target.value })} /></div>
              <div className="field" style={{ margin: 0 }}><label className="label">Pace (kg / week)</label>
                <select className="select" value={form.rate_kg_per_week} onChange={(e) => setForm({ ...form, rate_kg_per_week: e.target.value })}>
                  <option value="0.25">0.25 — gentle</option><option value="0.5">0.5 — standard</option><option value="0.75">0.75 — aggressive</option><option value="1">1.0 — very aggressive</option>
                </select></div>
            </div>
            <div className="field" style={{ marginBottom: 0, marginTop: 10 }}><label className="label">Activity level</label>
              <select className="select" value={form.activity_level} onChange={(e) => setForm({ ...form, activity_level: e.target.value })}>
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
    <div className="stack">
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
        <div className="grid grid-3" style={{ gap: 8, marginTop: 14 }}>
          <div className="kpi"><div className="kpi-label">Deposited</div><div className="kpi-value" style={{ fontSize: 18 }}>{fmt(month.deposited)}</div></div>
          <div className="kpi"><div className="kpi-label">Eaten</div><div className="kpi-value" style={{ fontSize: 18 }}>{fmt(month.spent)}</div></div>
          <div className="kpi"><div className="kpi-label">Earned</div><div className="kpi-value" style={{ fontSize: 18, color: 'var(--green-600)' }}>+{fmt(month.earned)}</div></div>
        </div>
        <div className="subtle" style={{ fontSize: 12, marginTop: 10 }}>
          Monthly allowance {fmt(allowance)} kcal ({fmt(settings.daily_target)}/day) · goal {settings.goal_weight_kg}kg
          <button className="btn btn-ghost" style={{ minHeight: 24, padding: '0 8px', marginLeft: 8 }} onClick={() => setEditing(true)}>Edit</button>
        </div>
      </div>

      <div className="grid grid-2" style={{ gap: 12 }}>
        <div className="card">
          <h4 style={{ marginTop: 0 }}>🍽️ Log food</h4>
          <div className="subtle" style={{ fontSize: 12, marginBottom: 8 }}>Withdraws from your bank.</div>
          <input className="input" placeholder="What did you eat?" value={food.label} onChange={(e) => setFood({ ...food, label: e.target.value })} style={{ marginBottom: 8 }} />
          <div className="row" style={{ gap: 8 }}>
            <input className="input" type="number" placeholder="kcal" value={food.kcal} onChange={(e) => setFood({ ...food, kcal: e.target.value })} style={{ flex: 1 }} />
            <button className="btn btn-secondary" disabled={!food.kcal} onClick={addFood}>Subtract</button>
          </div>
        </div>
        <div className="card">
          <h4 style={{ marginTop: 0 }}>🏃 Log exercise</h4>
          <div className="subtle" style={{ fontSize: 12, marginBottom: 8 }}>Adds calories to your bank.</div>
          <div className="row" style={{ gap: 8, marginBottom: 8 }}>
            <select className="select" value={ex.activity} onChange={(e) => setEx({ ...ex, activity: e.target.value })} style={{ flex: 1 }}>
              {METS.map((m) => <option key={m.key} value={m.key}>{m.key}</option>)}
            </select>
            <input className="input" type="number" placeholder="min" value={ex.minutes} onChange={(e) => setEx({ ...ex, minutes: e.target.value })} style={{ width: 80 }} />
          </div>
          <div className="row" style={{ gap: 8 }}>
            <input className="input" type="number" placeholder="or kcal directly" value={ex.kcal} onChange={(e) => setEx({ ...ex, kcal: e.target.value })} style={{ flex: 1 }} />
            <button className="btn btn-secondary" disabled={!ex.minutes && !ex.kcal} onClick={addExercise}>Add</button>
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
                    <button className="btn btn-ghost" style={{ minHeight: 24, padding: '0 8px' }} onClick={() => delTxn(t.id)}>✕</button>
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
