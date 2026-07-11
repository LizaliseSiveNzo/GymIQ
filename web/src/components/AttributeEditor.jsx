/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { ATTR_GROUPS } from '../lib/attributes.js';

const FEET = [['left', 'Left'], ['right', 'Right'], ['both', 'Both']];

function Rate({ value = 0, onChange }) {
  return (
    <div className="row" style={{ gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button type="button" key={n} onClick={() => onChange(n)}
          style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: 20, lineHeight: 1,
            color: n <= value ? 'var(--warning)' : 'var(--border-strong)' }}>★</button>
      ))}
    </div>
  );
}

export default function AttributeEditor({ playerId }) {
  const [profile, setProfile] = useState({ strong_foot: '', weak_foot: 0, height_cm: '', weight_kg: '' });
  const [attrs, setAttrs] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');

  useEffect(() => { (async () => {
    const { data: p } = await supabase.from('players').select('strong_foot,weak_foot,height_cm,weight_kg').eq('id', playerId).single();
    if (p) setProfile({ strong_foot: p.strong_foot || '', weak_foot: p.weak_foot || 0, height_cm: p.height_cm || '', weight_kg: p.weight_kg || '' });
    const { data: a } = await supabase.from('player_attributes').select('attribute,rating').eq('player_id', playerId);
    setAttrs(Object.fromEntries((a || []).map((x) => [x.attribute, x.rating])));
  })(); }, [playerId]);

  const setA = (k, v) => setAttrs((s) => ({ ...s, [k]: v }));

  async function save() {
    setBusy(true); setErr(''); setMsg('');
    try {
      const { error: e1 } = await supabase.from('players').update({
        strong_foot: profile.strong_foot || null,
        weak_foot: profile.weak_foot || null,
        height_cm: profile.height_cm ? Number(profile.height_cm) : null,
        weight_kg: profile.weight_kg ? Number(profile.weight_kg) : null,
      }).eq('id', playerId);
      if (e1) { setErr(e1.message); return; }
      const rows = Object.entries(attrs).filter(([, v]) => v).map(([attribute, rating]) => ({
        player_id: playerId, attribute, rating, updated_at: new Date().toISOString(),
      }));
      if (rows.length) {
        const { error: e2 } = await supabase.from('player_attributes').upsert(rows, { onConflict: 'player_id,attribute' });
        if (e2) { setErr(e2.message); return; }
      }
      setMsg('Player card updated.');
    } finally { setBusy(false); }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h4>⚡ Rate attributes</h4>
      <div className="grid grid-4" style={{ gap: 12, marginBottom: 8 }}>
        <div className="field" style={{ margin: 0 }}><label className="label">Strong foot</label>
          <select className="select" value={profile.strong_foot} onChange={(e) => setProfile((p) => ({ ...p, strong_foot: e.target.value }))}>
            <option value="">—</option>{FEET.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div className="field" style={{ margin: 0 }}><label className="label">Weak foot</label>
          <select className="select" value={profile.weak_foot} onChange={(e) => setProfile((p) => ({ ...p, weak_foot: Number(e.target.value) }))}>
            <option value={0}>—</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}★</option>)}</select></div>
        <div className="field" style={{ margin: 0 }}><label className="label">Height (cm)</label>
          <input className="input" type="number" value={profile.height_cm} onChange={(e) => setProfile((p) => ({ ...p, height_cm: e.target.value }))} /></div>
        <div className="field" style={{ margin: 0 }}><label className="label">Weight (kg)</label>
          <input className="input" type="number" value={profile.weight_kg} onChange={(e) => setProfile((p) => ({ ...p, weight_kg: e.target.value }))} /></div>
      </div>

      {ATTR_GROUPS.map(([g, list]) => (
        <div key={g} style={{ marginTop: 12 }}>
          <div className="subtle" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>{g}</div>
          {list.map(([k, l]) => (
            <div key={k} className="row between" style={{ padding: '4px 0' }}>
              <span style={{ fontSize: 14 }}>{l}</span>
              <Rate value={attrs[k] || 0} onChange={(v) => setA(k, v)} />
            </div>
          ))}
        </div>
      ))}

      {err && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</p>}
      {msg && <p style={{ color: 'var(--green-700)', fontSize: 13 }}>{msg}</p>}
      <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save player card'}</button>
    </div>
  );
}
