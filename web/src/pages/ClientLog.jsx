/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient.js';

export default function ClientLog() {
  const { session, profile } = useAuth();
  if (session?.demo || !profile) return <AppShell role="player" active="Log session" title="Log session"><div className="card">Loading…</div></AppShell>;
  return <AppShell role="player" active="Log session" title="Log session"><LogSession cid={profile.id} /></AppShell>;
}

function LogSession({ cid }) {
  const [days, setDays] = useState([]);
  const [ex, setEx] = useState({});
  const [dayId, setDayId] = useState('');
  const [rows, setRows] = useState([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { (async () => {
    const { data: p } = await supabase.from('workout_programmes').select('*').eq('client_id', cid).eq('is_active', true).limit(1);
    if (!p?.[0]) { setDays([]); return; }
    const { data: dd } = await supabase.from('programme_days').select('*').eq('programme_id', p[0].id).order('sort_order');
    setDays(dd || []);
    const ids = (dd || []).map((d) => d.id);
    if (ids.length) {
      const { data: xx } = await supabase.from('programme_exercises').select('*').in('day_id', ids).order('sort_order');
      const map = {}; (xx || []).forEach((e) => { (map[e.day_id] ||= []).push(e); }); setEx(map);
    }
  })(); }, [cid]);

  function pickDay(id) {
    setDayId(id);
    if (id && ex[id]) setRows(ex[id].map((e) => ({ exercise_name: e.name, weight: '', reps: '', pex: e.id })));
    else setRows([{ exercise_name: '', weight: '', reps: '', pex: null }]);
  }
  const setRow = (i, k, v) => setRows((r) => r.map((row, j) => j === i ? { ...row, [k]: v } : row));
  const addRow = () => setRows((r) => [...r, { exercise_name: '', weight: '', reps: '', pex: null }]);
  const delRow = (i) => setRows((r) => r.filter((_, j) => j !== i));

  async function save() {
    const valid = rows.filter((r) => r.exercise_name.trim() && (r.weight || r.reps));
    if (valid.length === 0) { setMsg('Add at least one exercise with a weight or reps.'); return; }
    setBusy(true); setMsg('');
    try {
      const { data: log, error } = await supabase.from('workout_logs')
        .insert({ client_id: cid, day_id: dayId || null, note: note.trim() || null }).select('id').single();
      if (error) { setMsg(error.message); return; }
      const sets = valid.map((r, idx) => ({
        client_id: cid, log_id: log.id, exercise_name: r.exercise_name.trim(),
        programme_exercise_id: r.pex || null, set_number: idx + 1,
        weight: r.weight ? parseFloat(r.weight) : null, reps: r.reps ? parseInt(r.reps, 10) : null,
      }));
      const { error: e2 } = await supabase.from('logged_sets').insert(sets);
      if (e2) { setMsg(e2.message); return; }
      setMsg('Session saved 💪'); setRows([]); setDayId(''); setNote('');
    } finally { setBusy(false); }
  }

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
              <input className="input" style={{ flex: 2, minWidth: 140 }} placeholder="Exercise" value={r.exercise_name} onChange={(e) => setRow(i, 'exercise_name', e.target.value)} />
              <input className="input" style={{ flex: 1, minWidth: 70 }} type="number" step="0.5" placeholder="kg" value={r.weight} onChange={(e) => setRow(i, 'weight', e.target.value)} />
              <input className="input" style={{ flex: 1, minWidth: 60 }} type="number" placeholder="reps" value={r.reps} onChange={(e) => setRow(i, 'reps', e.target.value)} />
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
      <button className="btn btn-primary btn-block" style={{ marginTop: 8 }} disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save session'}</button>
      {msg && <p style={{ color: msg.includes('saved') ? 'var(--success)' : 'var(--danger)', fontSize: 13, marginTop: 10 }}>{msg}</p>}
    </div>
  );
}
