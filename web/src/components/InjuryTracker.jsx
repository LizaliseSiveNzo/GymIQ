/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

export const STAGES = [
  ['rest',              'Rest'],
  ['rehab',             'Rehab'],
  ['partial_training',  'Partial training'],
  ['full_training',     'Full training'],
  ['match_fit',         'Match fit'],
];
const SEVERITY = { minor: 'badge-neutral', moderate: 'badge-warning', severe: 'badge-danger' };
const BODY = ['Head','Neck','Shoulder','Arm','Wrist/Hand','Back','Hip','Groin','Hamstring','Quad','Knee','Calf','Ankle','Foot','Other'];
const today = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const fmt = (d) => new Date(d).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

// Structured injury records with a return-to-play stage tracker (item 9).
export default function InjuryTracker({ playerId, canEdit = true, onChange }) {
  const [rows, setRows] = useState(null);
  const [adding, setAdding] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [f, setF] = useState({ injury_type: '', body_area: '', date_sustained: new Date().toISOString().slice(0,10),
                               severity: 'minor', expected_return: '', notes: '' });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [playerId]);

  async function load() {
    const { data } = await supabase.from('injuries')
      .select('id,injury_type,body_area,date_sustained,severity,expected_return,stage,notes,resolved_at,created_at')
      .eq('player_id', playerId).order('date_sustained', { ascending: false });
    setRows(data || []);
    onChange?.((data || []).some((r) => !r.resolved_at));
  }

  async function add(e) {
    e.preventDefault(); if (!f.injury_type.trim()) return;
    setBusy(true); setErr('');
    try {
      const { error } = await supabase.from('injuries').insert({
        player_id: playerId, injury_type: f.injury_type.trim(), body_area: f.body_area || null,
        date_sustained: f.date_sustained, severity: f.severity,
        expected_return: f.expected_return || null, notes: f.notes.trim() || null,
      });
      if (error) { setErr(error.message); return; }
      setF({ injury_type: '', body_area: '', date_sustained: new Date().toISOString().slice(0,10), severity: 'minor', expected_return: '', notes: '' });
      setAdding(false); await load();
    } finally { setBusy(false); }
  }

  async function setStage(inj, stage) {
    await supabase.from('injuries').update({ stage }).eq('id', inj.id);
    setRows((l) => l.map((r) => r.id === inj.id ? { ...r, stage } : r));
  }
  async function resolve(inj) {
    await supabase.from('injuries').update({ resolved_at: new Date().toISOString(), stage: 'match_fit' }).eq('id', inj.id);
    await load();
  }
  async function reopen(inj) {
    await supabase.from('injuries').update({ resolved_at: null }).eq('id', inj.id);
    await load();
  }
  async function remove(inj) {
    if (!window.confirm('Delete this injury record?')) return;
    await supabase.from('injuries').delete().eq('id', inj.id);
    await load();
  }

  if (rows === null) return <div className="card" style={{ marginTop: 16 }}>Loading injuries…</div>;

  const open = rows.filter((r) => !r.resolved_at);
  const past = rows.filter((r) => r.resolved_at);

  const Card = (inj) => {
    const idx = STAGES.findIndex(([k]) => k === inj.stage);
    const overdue = inj.expected_return && !inj.resolved_at && new Date(inj.expected_return) < today();
    return (
      <div key={inj.id} style={{ border: '1px solid var(--border)',
        borderLeft: `4px solid ${inj.resolved_at ? 'var(--success)' : overdue ? 'var(--danger)' : 'var(--warning, #f59e0b)'}`,
        borderRadius: 12, padding: '10px 12px' }}>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div style={{ minWidth: 170 }}>
            <strong>{inj.injury_type}</strong>{inj.body_area ? <span className="subtle"> · {inj.body_area}</span> : null}
            <div className="subtle" style={{ fontSize: 12, marginTop: 2 }}>
              Sustained {fmt(inj.date_sustained)}
              {inj.expected_return && <> · Expected back {fmt(inj.expected_return)}</>}
              {overdue && <span style={{ color: 'var(--danger)', fontWeight: 700 }}> · overdue</span>}
            </div>
            {inj.notes && <div className="subtle" style={{ fontSize: 12.5, marginTop: 4 }}>{inj.notes}</div>}
          </div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <span className={`badge ${SEVERITY[inj.severity] || 'badge-neutral'}`}>{inj.severity}</span>
            {inj.resolved_at
              ? <span className="badge badge-success">Resolved</span>
              : <span className="badge badge-warning">Out</span>}
            {canEdit && <button type="button" className="btn btn-ghost" style={{ minHeight: 26, padding: '2px 8px', color: 'var(--danger)' }} onClick={() => remove(inj)}>🗑</button>}
          </div>
        </div>

        {/* return-to-play stages */}
        {!inj.resolved_at && (
          <div style={{ marginTop: 10 }}>
            <div className="subtle" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 }}>Return to play</div>
            <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
              {STAGES.map(([key, label], i) => {
                const reached = i <= idx;
                return (
                  <button key={key} type="button" disabled={!canEdit} onClick={() => setStage(inj, key)}
                    className="badge"
                    style={{ cursor: canEdit ? 'pointer' : 'default', flex: '1 1 auto', textAlign: 'center',
                      background: reached ? 'var(--green-600)' : 'transparent',
                      color: reached ? '#fff' : 'inherit',
                      border: `1px solid ${reached ? 'var(--green-600)' : 'var(--border)'}`,
                      fontWeight: i === idx ? 700 : 400 }}>
                    {label}
                  </button>
                );
              })}
            </div>
            <div style={{ height: 5, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden', marginTop: 6 }}>
              <div style={{ width: `${((idx + 1) / STAGES.length) * 100}%`, height: '100%', background: 'var(--green-600)', transition: 'width .3s ease' }} />
            </div>
          </div>
        )}

        {canEdit && (
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            {inj.resolved_at
              ? <button type="button" className="btn btn-ghost" style={{ minHeight: 28, padding: '2px 8px' }} onClick={() => reopen(inj)}>↩ Reopen</button>
              : <button type="button" className="btn btn-secondary" style={{ minHeight: 28, padding: '2px 10px' }} onClick={() => resolve(inj)}>✓ Mark fit / resolved</button>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="section-header">
        <h4 style={{ margin: 0 }}>🩹 Injuries &amp; return to play</h4>
        <div className="row" style={{ gap: 6 }}>
          {open.length > 0 && <span className="badge badge-warning">{open.length} open</span>}
          {canEdit && <button type="button" className="btn btn-primary" style={{ minHeight: 30, padding: '4px 10px' }} onClick={() => setAdding((v) => !v)}>{adding ? 'Close' : '＋ Injury'}</button>}
        </div>
      </div>

      {adding && canEdit && (
        <form onSubmit={add} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <div className="grid grid-2" style={{ gap: 10 }}>
            <div className="field" style={{ margin: 0 }}><label className="label">Injury type</label>
              <input className="input" placeholder="e.g. Hamstring strain" value={f.injury_type} onChange={(e) => set('injury_type', e.target.value)} /></div>
            <div className="field" style={{ margin: 0 }}><label className="label">Body area</label>
              <select className="select" value={f.body_area} onChange={(e) => set('body_area', e.target.value)}>
                <option value="">—</option>{BODY.map((b) => <option key={b} value={b}>{b}</option>)}</select></div>
            <div className="field" style={{ margin: 0 }}><label className="label">Date sustained</label>
              <input className="input" type="date" value={f.date_sustained} onChange={(e) => set('date_sustained', e.target.value)} /></div>
            <div className="field" style={{ margin: 0 }}><label className="label">Severity</label>
              <select className="select" value={f.severity} onChange={(e) => set('severity', e.target.value)}>
                <option value="minor">Minor</option><option value="moderate">Moderate</option><option value="severe">Severe</option></select></div>
            <div className="field" style={{ margin: 0 }}><label className="label">Expected return</label>
              <input className="input" type="date" value={f.expected_return} onChange={(e) => set('expected_return', e.target.value)} /></div>
          </div>
          <div className="field"><label className="label">Notes (optional)</label>
            <textarea className="textarea" rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></div>
          {err && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</p>}
          <button className="btn btn-primary btn-block" disabled={busy || !f.injury_type.trim()}>{busy ? 'Saving…' : 'Record injury'}</button>
        </form>
      )}

      {rows.length === 0 ? <p className="subtle" style={{ margin: 0 }}>No injuries recorded. 🎉</p> : (
        <>
          {open.length > 0
            ? <div className="stack" style={{ gap: 10 }}>{open.map(Card)}</div>
            : <p className="subtle" style={{ margin: 0 }}>No open injuries — player is available.</p>}
          {past.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <button type="button" className="btn btn-ghost" style={{ minHeight: 30 }} onClick={() => setShowPast((v) => !v)}>
                {showPast ? '▲ Hide' : '▼ Show'} injury history ({past.length})
              </button>
              {showPast && <div className="stack" style={{ gap: 10, marginTop: 8 }}>{past.map(Card)}</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
