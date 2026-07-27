/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

export const watchUrl = (ex) => (ex.video_url && ex.video_url.trim())
  ? ex.video_url.trim()
  : `https://www.youtube.com/results?search_query=${encodeURIComponent(`${ex.name} proper form technique`)}`;

// Reusable library of workout blocks (Legs, Push, …), each holding exercises.
// Blocks are dropped onto calendar days. Editable by client (own id) or trainer.
export default function BlockLibrary({ clientId, readOnly = false }) {
  const [blocks, setBlocks] = useState(null);
  const [ex, setEx] = useState({});          // blockId -> exercises
  const [open, setOpen] = useState({});        // blockId -> expanded
  const [newBlock, setNewBlock] = useState('');
  const [exForm, setExForm] = useState({});    // blockId -> {name,sets,reps,weight,video}

  async function load() {
    const [{ data: bs }, { data: xs }] = await Promise.all([
      supabase.from('workout_blocks').select('*').eq('client_id', clientId).order('sort_order').order('created_at'),
      supabase.from('block_exercises').select('*').eq('client_id', clientId).order('sort_order'),
    ]);
    setBlocks(bs || []);
    const map = {}; (xs || []).forEach((e) => { (map[e.block_id] ||= []).push(e); }); setEx(map);
  }
  useEffect(() => { load(); }, [clientId]);

  async function addBlock() {
    if (!newBlock.trim()) return;
    const { data } = await supabase.from('workout_blocks').insert({ client_id: clientId, name: newBlock.trim(), sort_order: (blocks?.length || 0) }).select('id').single();
    setNewBlock(''); setOpen((o) => ({ ...o, [data.id]: true })); load();
  }
  async function delBlock(id) { await supabase.from('workout_blocks').delete().eq('id', id); load(); }
  function exField(bid, k, v) { setExForm((f) => ({ ...f, [bid]: { ...(f[bid] || {}), [k]: v } })); }
  async function addExercise(bid) {
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

  if (blocks === null) return <div className="card">Loading…</div>;

  return (
    <div className="stack">
      {!readOnly && (
        <div className="card">
          <h4 style={{ marginTop: 0 }}>New block</h4>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="Block name (e.g. Legs, Push, Arms)"
              value={newBlock} onChange={(e) => setNewBlock(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addBlock()} />
            <button className="btn btn-primary" disabled={!newBlock.trim()} onClick={addBlock}>Add block</button>
          </div>
          <p className="subtle" style={{ fontSize: 12, margin: '8px 0 0' }}>Build a block once, then drop it onto any day in the calendar — it brings all its exercises.</p>
        </div>
      )}

      {blocks.length === 0 ? <div className="card"><p className="subtle" style={{ margin: 0 }}>No blocks yet. Create one above (e.g. “Legs”) and add its exercises.</p></div>
       : blocks.map((b) => (
        <div className="card" key={b.id}>
          <div className="row between" style={{ cursor: 'pointer' }} onClick={() => setOpen((o) => ({ ...o, [b.id]: !o[b.id] }))}>
            <h4 style={{ margin: 0 }}>{b.name} <span className="subtle" style={{ fontSize: 12, fontWeight: 400 }}>· {(ex[b.id] || []).length} exercise{(ex[b.id] || []).length === 1 ? '' : 's'}</span></h4>
            <div className="row" style={{ gap: 8 }}>
              {!readOnly && <button className="btn btn-ghost" style={{ minHeight: 28, padding: '0 8px' }} onClick={(e) => { e.stopPropagation(); delBlock(b.id); }}>Delete</button>}
              <span className="subtle">{open[b.id] ? '▾' : '▸'}</span>
            </div>
          </div>

          {open[b.id] && (
            <div style={{ marginTop: 10 }}>
              {(ex[b.id] || []).length > 0 && (
                <div className="stack" style={{ gap: 6, marginBottom: 10 }}>
                  {(ex[b.id] || []).map((e) => (
                    <div key={e.id} className="row between" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px' }}>
                      <div><strong>{e.name}</strong>
                        <div className="subtle" style={{ fontSize: 12 }}>{e.target_sets ? `${e.target_sets}×` : ''}{e.target_reps || ''}{e.target_weight ? ` @ ${e.target_weight}kg` : ''}</div>
                      </div>
                      <div className="row" style={{ gap: 8 }}>
                        <a href={watchUrl(e)} target="_blank" rel="noopener noreferrer" className="badge badge-info" style={{ textDecoration: 'none' }}>▶ Watch</a>
                        {!readOnly && <button className="btn btn-ghost" style={{ minHeight: 26, padding: '0 8px' }} onClick={() => delExercise(e.id)}>✕</button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!readOnly && (
                <>
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    <input className="input" style={{ flex: 2, minWidth: 140 }} placeholder="Exercise" value={exForm[b.id]?.name || ''} onChange={(e) => exField(b.id, 'name', e.target.value)} />
                    <input className="input" style={{ width: 64 }} type="number" placeholder="sets" value={exForm[b.id]?.sets || ''} onChange={(e) => exField(b.id, 'sets', e.target.value)} />
                    <input className="input" style={{ width: 80 }} placeholder="reps" value={exForm[b.id]?.reps || ''} onChange={(e) => exField(b.id, 'reps', e.target.value)} />
                    <input className="input" style={{ width: 72 }} type="number" placeholder="kg" value={exForm[b.id]?.weight || ''} onChange={(e) => exField(b.id, 'weight', e.target.value)} />
                  </div>
                  <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    <input className="input" style={{ flex: 1, minWidth: 180 }} placeholder="Video link (optional — blank auto-searches YouTube)" value={exForm[b.id]?.video || ''} onChange={(e) => exField(b.id, 'video', e.target.value)} />
                    <button className="btn btn-secondary" style={{ minHeight: 40 }} disabled={!exForm[b.id]?.name?.trim()} onClick={() => addExercise(b.id)}>Add exercise</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
