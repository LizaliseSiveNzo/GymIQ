/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

// Macro targets + meal plan editor for a client_id. Shared by trainer and client.
export default function NutritionPlanner({ clientId }) {
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
