/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { BLOCK_CATEGORIES, catColor } from '../lib/blockCategories.js';

export const watchUrl = (ex) => (ex.video_url && ex.video_url.trim())
  ? ex.video_url.trim()
  : `https://www.youtube.com/results?search_query=${encodeURIComponent(`${ex.name} proper form technique`)}`;

// Exercise-library filter tabs (the primary_category of a preset move).
const CATS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Cardio', 'Full Body'];

// Reusable library of workout blocks (Legs, Push, …), each holding exercises.
// Exercises are added from the global preset library (pick, don't type) or by hand.
// Blocks are dropped onto calendar days. Editable by client (own id) or trainer.
export default function BlockLibrary({ clientId, readOnly = false }) {
  const [blocks, setBlocks] = useState(null);
  const [ex, setEx] = useState({});          // blockId -> exercises
  const [presets, setPresets] = useState([]);
  const [open, setOpen] = useState({});        // blockId -> expanded
  const [newBlock, setNewBlock] = useState('');
  const [newCat, setNewCat] = useState('');
  const [showDesc, setShowDesc] = useState({}); // exId -> reveal description
  const [pick, setPick] = useState({});        // blockId -> {cat, q}
  const [exForm, setExForm] = useState({});    // blockId -> {name,sets,reps,weight,video}

  async function load() {
    const [{ data: bs }, { data: xs }, { data: ps }] = await Promise.all([
      supabase.from('workout_blocks').select('*').eq('client_id', clientId).order('sort_order').order('created_at'),
      supabase.from('block_exercises').select('*').eq('client_id', clientId).order('sort_order'),
      supabase.from('exercise_presets').select('*').order('primary_category').order('sort_order'),
    ]);
    setBlocks(bs || []);
    setPresets(ps || []);
    const map = {}; (xs || []).forEach((e) => { (map[e.block_id] ||= []).push(e); }); setEx(map);
  }
  useEffect(() => { load(); }, [clientId]);

  async function createBlock(name, category) {
    if (!name.trim()) return;
    const { data } = await supabase.from('workout_blocks')
      .insert({ client_id: clientId, name: name.trim(), category: category || null, sort_order: (blocks?.length || 0) })
      .select('id').single();
    setNewBlock(''); setNewCat(''); setOpen((o) => ({ ...o, [data.id]: true })); load();
  }
  async function delBlock(id) { await supabase.from('workout_blocks').delete().eq('id', id); load(); }

  async function addPreset(bid, p) {
    await supabase.from('block_exercises').insert({
      client_id: clientId, block_id: bid, name: p.name,
      description: p.description || null, muscles: p.target_muscles || null,
      equipment: p.equipment || null, video_url: p.video_url || null, preset_id: p.id,
      sort_order: (ex[bid]?.length || 0),
    });
    load();
  }
  function exField(bid, k, v) { setExForm((f) => ({ ...f, [bid]: { ...(f[bid] || {}), [k]: v } })); }
  async function addManual(bid) {
    const f = exForm[bid] || {};
    if (!f.name?.trim()) return;
    await supabase.from('block_exercises').insert({
      client_id: clientId, block_id: bid, name: f.name.trim(),
      target_sets: f.sets ? parseInt(f.sets, 10) : null, target_reps: f.reps || null,
      target_weight: f.weight ? parseFloat(f.weight) : null, video_url: f.video?.trim() || null,
      sort_order: (ex[bid]?.length || 0),
    });
    setExForm((s) => ({ ...s, [bid]: {} })); load();
  }
  async function delExercise(id) { await supabase.from('block_exercises').delete().eq('id', id); load(); }
  function pickField(bid, k, v) { setPick((p) => ({ ...p, [bid]: { ...(p[bid] || {}), [k]: v } })); }

  if (blocks === null) return <div className="card">Loading…</div>;

  return (
    <div className="stack">
      {!readOnly && (
        <div className="card">
          <h4 style={{ marginTop: 0 }}>New block</h4>
          <div className="subtle" style={{ fontSize: 12, marginBottom: 8 }}>Start from a category — it creates a colour-coded block you fill with exercises:</div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {BLOCK_CATEGORIES.map((c) => (
              <button key={c} type="button" onClick={() => createBlock(c, c)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 999,
                  border: `1px solid ${catColor(c)}`, background: `${catColor(c)}22`, color: 'var(--ink)', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: catColor(c) }} /> {c}
              </button>
            ))}
          </div>
          <div className="subtle" style={{ fontSize: 12, margin: '14px 0 6px' }}>Or make a custom block:</div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <input className="input" style={{ flex: 1, minWidth: 160 }} placeholder="Block name (e.g. Upper A, Leg Day)"
              value={newBlock} onChange={(e) => setNewBlock(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createBlock(newBlock, newCat)} />
            <select className="select" style={{ minWidth: 130 }} value={newCat} onChange={(e) => setNewCat(e.target.value)}>
              <option value="">Colour…</option>
              {BLOCK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button className="btn btn-primary" disabled={!newBlock.trim()} onClick={() => createBlock(newBlock, newCat)}>Add block</button>
          </div>
          <p className="subtle" style={{ fontSize: 12, margin: '8px 0 0' }}>Build a block once, then drop it onto any day in the calendar — it brings all its exercises. Add moves from the {presets.length}-exercise library, or type your own.</p>
        </div>
      )}

      {blocks.length === 0 ? <div className="card"><p className="subtle" style={{ margin: 0 }}>No blocks yet. Create one above (e.g. “Legs”) and add its exercises.</p></div>
       : blocks.map((b) => (
        <div className="card" key={b.id} style={{ borderLeft: `4px solid ${catColor(b.category)}` }}>
          <div className="row between" style={{ cursor: 'pointer' }} onClick={() => setOpen((o) => ({ ...o, [b.id]: !o[b.id] }))}>
            <h4 style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: catColor(b.category), flexShrink: 0 }} />
              {b.name} <span className="subtle" style={{ fontSize: 12, fontWeight: 400 }}>{b.category ? `· ${b.category} ` : ''}· {(ex[b.id] || []).length} exercise{(ex[b.id] || []).length === 1 ? '' : 's'}</span></h4>
            <div className="row" style={{ gap: 8 }}>
              {!readOnly && <button className="btn btn-ghost" style={{ minHeight: 28, padding: '0 8px' }} onClick={(e) => { e.stopPropagation(); delBlock(b.id); }}>Delete</button>}
              <span className="subtle">{open[b.id] ? '▾' : '▸'}</span>
            </div>
          </div>

          {open[b.id] && (
            <div style={{ marginTop: 10 }}>
              {(ex[b.id] || []).length > 0 && (
                <div className="stack" style={{ gap: 6, marginBottom: 12 }}>
                  {(ex[b.id] || []).map((e) => (
                    <div key={e.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px' }}>
                      <div className="row between">
                        <div style={{ minWidth: 0 }}><strong>{e.name}</strong>
                          <div className="subtle" style={{ fontSize: 12 }}>
                            {e.muscles || ''}
                            {(e.target_sets || e.target_reps || e.target_weight) ? `${e.muscles ? ' · ' : ''}${e.target_sets ? `${e.target_sets}×` : ''}${e.target_reps || ''}${e.target_weight ? ` @ ${e.target_weight}kg` : ''}` : ''}
                          </div>
                        </div>
                        <div className="row" style={{ gap: 8 }}>
                          {e.description && <button className="btn btn-ghost" style={{ minHeight: 26, padding: '0 8px' }} onClick={() => setShowDesc((s) => ({ ...s, [e.id]: !s[e.id] }))} title="How to perform">ⓘ</button>}
                          <a href={watchUrl(e)} target="_blank" rel="noopener noreferrer" className="badge badge-info" style={{ textDecoration: 'none' }}>▶ Watch</a>
                          {!readOnly && <button className="btn btn-ghost" style={{ minHeight: 26, padding: '0 8px' }} onClick={() => delExercise(e.id)}>✕</button>}
                        </div>
                      </div>
                      {showDesc[e.id] && e.description && (
                        <p style={{ margin: '8px 0 0', fontSize: 13, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                          {e.description}{e.equipment ? <span className="subtle"><br />Equipment: {e.equipment}</span> : null}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!readOnly && <PresetPicker presets={presets} pick={pick[b.id] || {}} onField={(k, v) => pickField(b.id, k, v)} onAdd={(p) => addPreset(b.id, p)} added={(ex[b.id] || [])} />}

              {!readOnly && (
                <details style={{ marginTop: 10 }}>
                  <summary className="subtle" style={{ cursor: 'pointer', fontSize: 13 }}>Or add a custom exercise</summary>
                  <div style={{ marginTop: 8 }}>
                    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                      <input className="input" style={{ flex: 2, minWidth: 140 }} placeholder="Exercise" value={exForm[b.id]?.name || ''} onChange={(e) => exField(b.id, 'name', e.target.value)} />
                      <input className="input" style={{ width: 64 }} type="number" placeholder="sets" value={exForm[b.id]?.sets || ''} onChange={(e) => exField(b.id, 'sets', e.target.value)} />
                      <input className="input" style={{ width: 80 }} placeholder="reps" value={exForm[b.id]?.reps || ''} onChange={(e) => exField(b.id, 'reps', e.target.value)} />
                      <input className="input" style={{ width: 72 }} type="number" placeholder="kg" value={exForm[b.id]?.weight || ''} onChange={(e) => exField(b.id, 'weight', e.target.value)} />
                    </div>
                    <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      <input className="input" style={{ flex: 1, minWidth: 180 }} placeholder="Video link (optional — blank auto-searches YouTube)" value={exForm[b.id]?.video || ''} onChange={(e) => exField(b.id, 'video', e.target.value)} />
                      <button className="btn btn-secondary" style={{ minHeight: 40 }} disabled={!exForm[b.id]?.name?.trim()} onClick={() => addManual(b.id)}>Add exercise</button>
                    </div>
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Category-filtered, searchable preset list. Click a move to add it to the block.
function PresetPicker({ presets, pick, onField, onAdd, added }) {
  const cat = pick.cat || 'Chest';
  const q = (pick.q || '').toLowerCase();
  const addedNames = useMemo(() => new Set((added || []).map((a) => a.name)), [added]);
  const list = useMemo(() => presets.filter((p) =>
    p.primary_category === cat && (!q || p.name.toLowerCase().includes(q) || (p.target_muscles || '').toLowerCase().includes(q))
  ), [presets, cat, q]);

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
      <div className="row between" style={{ marginBottom: 8 }}>
        <strong style={{ fontSize: 14 }}>Add from library</strong>
        <input className="input" style={{ maxWidth: 180, minHeight: 32 }} placeholder="Search moves…" value={pick.q || ''} onChange={(e) => onField('q', e.target.value)} />
      </div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {CATS.map((c) => (
          <button key={c} type="button" onClick={() => onField('cat', c)}
            className={`badge ${c === cat ? 'badge-info' : 'badge-neutral'}`}
            style={{ cursor: 'pointer', border: 'none' }}>{c}</button>
        ))}
      </div>
      <div className="stack" style={{ gap: 6, maxHeight: 260, overflowY: 'auto' }}>
        {list.length === 0 ? <p className="subtle" style={{ margin: 0, fontSize: 13 }}>No moves match.</p>
         : list.map((p) => {
          const isAdded = addedNames.has(p.name);
          return (
            <div key={p.id} className="row between" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '7px 10px', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: 13 }}>{p.name}</strong>
                <div className="subtle" style={{ fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.target_muscles} · {p.equipment}</div>
              </div>
              <button className="btn btn-secondary" style={{ minHeight: 30, padding: '0 10px', flexShrink: 0 }} disabled={isAdded} onClick={() => onAdd(p)}>{isAdded ? 'Added' : '+ Add'}</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
