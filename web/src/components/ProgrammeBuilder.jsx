/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

// Full programme editor for a given client_id. Used by both the trainer (on a
// client) and the client themselves (on their own id). RLS scopes writes.
export default function ProgrammeBuilder({ clientId }) {
  const [prog, setProg] = useState(undefined);
  const [days, setDays] = useState([]);
  const [ex, setEx] = useState({});
  const [newProg, setNewProg] = useState('');
  const [newDay, setNewDay] = useState('');
  const [exForm, setExForm] = useState({});

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
