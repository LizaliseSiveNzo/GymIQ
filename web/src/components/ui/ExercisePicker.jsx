/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient.js';

// Reusable exercise catalog browser/picker. Reads the global `exercises`,
// `muscles`, and `equipment_items` tables. In `pick` mode each row has a + that
// calls onPick(exercise). The equipment filter narrows to a chosen gym set.
export default function ExercisePicker({ mode = 'browse', onPick, addedIds = [] }) {
  const [exercises, setExercises] = useState(null);
  const [muscles, setMuscles] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState('all');
  const [type, setType] = useState('all');        // all | weighted | bodyweight
  const [lat, setLat] = useState('all');           // all | bilateral | unilateral
  const [equipSet, setEquipSet] = useState(null);  // Set of enabled ids, null = all
  const [showEquip, setShowEquip] = useState(false);
  const [openCue, setOpenCue] = useState({});
  const added = useMemo(() => new Set(addedIds), [addedIds]);

  useEffect(() => { (async () => {
    const [{ data: ex }, { data: mu }, { data: eq }] = await Promise.all([
      supabase.from('exercises').select('*').order('name'),
      supabase.from('muscles').select('*').order('sort_order'),
      supabase.from('equipment_items').select('*').order('sort_order'),
    ]);
    setExercises(ex || []); setMuscles(mu || []); setEquipment(eq || []);
  })(); }, []);

  const mName = useMemo(() => Object.fromEntries(muscles.map((m) => [m.id, m.name])), [muscles]);
  const eName = useMemo(() => Object.fromEntries(equipment.map((e) => [e.id, e.name])), [equipment]);

  const list = useMemo(() => {
    if (!exercises) return [];
    const query = q.trim().toLowerCase();
    return exercises.filter((x) => {
      const secKeys = Object.keys(x.secondary_muscle_fraction || {});
      if (muscle !== 'all' && x.primary_muscle_id !== muscle && !secKeys.includes(muscle)) return false;
      if (type === 'weighted' && !x.is_weighted) return false;
      if (type === 'bodyweight' && x.is_weighted) return false;
      if (lat === 'bilateral' && x.laterality !== 'bilateral') return false;
      if (lat === 'unilateral' && !String(x.laterality).startsWith('unilateral')) return false;
      if (equipSet && (x.equipment_ids || []).some((e) => !equipSet.has(e))) return false;
      if (query) {
        const hay = [x.name, mName[x.primary_muscle_id] || '', ...secKeys.map((k) => mName[k] || ''),
          ...(x.equipment_ids || []).map((e) => eName[e] || '')].join(' ').toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [exercises, q, muscle, type, lat, equipSet, mName, eName]);

  function toggleEquip(id) {
    setEquipSet((prev) => {
      const base = prev ? new Set(prev) : new Set(equipment.map((e) => e.id));
      if (base.has(id)) base.delete(id); else base.add(id);
      return base;
    });
  }
  const allEquip = () => setEquipSet(null);
  const noEquip = () => setEquipSet(new Set());
  const equipCount = equipSet ? equipSet.size : equipment.length;

  const seg = (val, set, opts) => (
    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
      {opts.map(([v, label]) => (
        <button key={v} type="button" onClick={() => set(v)}
          className={`badge ${val === v ? 'badge-info' : 'badge-neutral'}`} style={{ cursor: 'pointer', border: 'none' }}>{label}</button>
      ))}
    </div>
  );

  if (exercises === null) return <div className="card">Loading catalog…</div>;

  return (
    <div className="stack">
      <div className="card">
        <input className="input" placeholder="Search exercises or muscles…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="stack" style={{ gap: 8, marginTop: 10 }}>
          <select className="select" value={muscle} onChange={(e) => setMuscle(e.target.value)}>
            <option value="all">All muscles</option>
            {muscles.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          {seg(type, setType, [['all', 'All'], ['weighted', 'Weighted'], ['bodyweight', 'Bodyweight']])}
          {seg(lat, setLat, [['all', 'Any grip'], ['bilateral', 'Bilateral'], ['unilateral', 'Unilateral']])}
          <button className="btn btn-ghost" style={{ justifyContent: 'space-between' }} onClick={() => setShowEquip((v) => !v)}>
            <span>🏋 Equipment ({equipCount}/{equipment.length})</span><span>{showEquip ? '▾' : '▸'}</span>
          </button>
          {showEquip && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 10 }}>
              <div className="row" style={{ gap: 8, marginBottom: 8 }}>
                <button className="btn btn-ghost" style={{ minHeight: 28, padding: '0 10px' }} onClick={allEquip}>Select all</button>
                <button className="btn btn-ghost" style={{ minHeight: 28, padding: '0 10px' }} onClick={noEquip}>Clear</button>
                <span className="subtle" style={{ fontSize: 12, alignSelf: 'center' }}>Narrow to your gym's kit</span>
              </div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {equipment.map((e) => {
                  const on = !equipSet || equipSet.has(e.id);
                  return (
                    <button key={e.id} type="button" onClick={() => toggleEquip(e.id)}
                      className={`badge ${on ? 'badge-info' : 'badge-neutral'}`} style={{ cursor: 'pointer', border: 'none', opacity: on ? 1 : 0.6 }}>{e.name}</button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="subtle" style={{ fontSize: 12, marginTop: 10 }}>{list.length} of {exercises.length} exercises</div>
      </div>

      <div className="stack" style={{ gap: 6 }}>
        {list.length === 0 ? <div className="card"><p className="subtle" style={{ margin: 0 }}>No exercises match those filters.</p></div>
         : list.map((x) => {
          const secs = Object.keys(x.secondary_muscle_fraction || {}).map((k) => mName[k] || k);
          const isAdded = added.has(x.id);
          return (
            <div key={x.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px' }}>
              <div className="row between">
                <div style={{ minWidth: 0 }}>
                  <strong>{x.name}</strong>
                  <div className="subtle" style={{ fontSize: 12 }}>
                    {mName[x.primary_muscle_id] || x.primary_muscle_id}{secs.length ? ` · ${secs.join(', ')}` : ''}
                  </div>
                  <div className="subtle" style={{ fontSize: 11 }}>
                    {(x.equipment_ids || []).map((e) => eName[e] || e).join(', ') || 'Bodyweight'}
                    {String(x.laterality).startsWith('unilateral') ? ' · unilateral' : ''}
                  </div>
                </div>
                <div className="row" style={{ gap: 8, flexShrink: 0 }}>
                  {x.cue_text && <button className="btn btn-ghost" style={{ minHeight: 26, padding: '0 8px' }} onClick={() => setOpenCue((o) => ({ ...o, [x.id]: !o[x.id] }))} title="How to perform">ⓘ</button>}
                  {mode === 'pick' && <button className="btn btn-secondary" style={{ minHeight: 30, padding: '0 10px' }} disabled={isAdded} onClick={() => onPick?.(x)}>{isAdded ? 'Added' : '+ Add'}</button>}
                </div>
              </div>
              {openCue[x.id] && x.cue_text && <p style={{ margin: '8px 0 0', fontSize: 13, borderTop: '1px solid var(--border)', paddingTop: 8 }}>{x.cue_text}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
