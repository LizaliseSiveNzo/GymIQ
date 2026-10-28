/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient.js';

export default function ClientProgress() {
  const { session, profile } = useAuth();
  if (session?.demo || !profile) return <AppShell role="player" active="Progress" title="Progress"><div className="card">Loading…</div></AppShell>;
  return <AppShell role="player" active="Progress" title="Progress"><Progress cid={profile.id} /></AppShell>;
}

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
