/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import NutritionPlanner from '../components/NutritionPlanner.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient.js';

export default function ClientNutritionPage() {
  const { session, profile } = useAuth();
  if (session?.demo || !profile) return <AppShell role="player" active="Nutrition" title="Nutrition"><div className="card">Loading…</div></AppShell>;
  return <AppShell role="player" active="Nutrition" title="Nutrition"><Nutrition cid={profile.id} /></AppShell>;
}

function Nutrition({ cid }) {
  const [today, setToday] = useState(null);
  const [f, setF] = useState({ kcal: '', protein_g: '', carbs_g: '', fat_g: '' });
  const dateStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  async function loadLog() {
    const { data: fl } = await supabase.from('food_logs').select('*').eq('client_id', cid).eq('log_date', dateStr).limit(1);
    const t = fl?.[0] || null;
    setToday(t);
    if (t) setF({ kcal: t.kcal ?? '', protein_g: t.protein_g ?? '', carbs_g: t.carbs_g ?? '', fat_g: t.fat_g ?? '' });
  }
  useEffect(() => { loadLog(); }, [cid]);

  async function saveLog(e) {
    e.preventDefault();
    const payload = {
      client_id: cid, log_date: dateStr,
      kcal: f.kcal ? parseInt(f.kcal, 10) : null, protein_g: f.protein_g ? parseInt(f.protein_g, 10) : null,
      carbs_g: f.carbs_g ? parseInt(f.carbs_g, 10) : null, fat_g: f.fat_g ? parseInt(f.fat_g, 10) : null,
    };
    if (today) await supabase.from('food_logs').update(payload).eq('id', today.id);
    else await supabase.from('food_logs').insert(payload);
    loadLog();
  }

  return (
    <div className="stack">
      <NutritionPlanner clientId={cid} />
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
