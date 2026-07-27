/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Calendar from './Calendar.jsx';
import { watchUrl } from './BlockLibrary.jsx';
import { supabase } from '../lib/supabaseClient.js';

const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const weekdayOf = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).getDay(); };

// Calendar hub. A day is composed of workout BLOCKS (from the Exercises library).
// Blocks repeat weekly on their weekday by default; a date can be overridden.
// Editable by the client (own id) and the trainer (a client's id) via RLS.
export default function WorkoutCalendar({ clientId, readOnly = false, exercisesPath = '/customer/exercises', onManageBlocks = null }) {
  // "Manage blocks" navigates to the Exercises page for clients, or fires a
  // callback (e.g. switch tab) when embedded in the trainer's client view.
  const ManageLink = ({ children, className }) => {
    const inline = className === 'link-inline';
    if (onManageBlocks) {
      const style = inline
        ? { background: 'none', border: 'none', padding: 0, color: 'var(--green-600)', cursor: 'pointer', font: 'inherit', textDecoration: 'underline' }
        : undefined;
      return <button type="button" className={inline ? undefined : (className || 'btn btn-ghost')} style={style} onClick={onManageBlocks}>{children}</button>;
    }
    return <Link to={exercisesPath} className={inline ? undefined : className} style={inline ? { color: 'var(--green-600)' } : undefined}>{children}</Link>;
  };
  const [recurring, setRecurring] = useState({}); // weekday -> { plan, blocks:[{id, block}] }
  const [overrides, setOverrides] = useState({}); // dateIso -> { plan, blocks:[...] }
  const [library, setLibrary] = useState([]);      // blocks with exercises
  const [events, setEvents] = useState([]);
  const [sel, setSel] = useState(null);
  const [addBlockId, setAddBlockId] = useState('');
  const [meal, setMeal] = useState('');
  const [openBlk, setOpenBlk] = useState({});
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [plans, dpb, blocks, blockEx, appts, logs, journal, metrics] = await Promise.all([
      supabase.from('day_plans').select('*').eq('client_id', clientId),
      supabase.from('day_plan_blocks').select('*').eq('client_id', clientId).order('sort_order'),
      supabase.from('workout_blocks').select('*').eq('client_id', clientId).order('sort_order'),
      supabase.from('block_exercises').select('*').eq('client_id', clientId).order('sort_order'),
      supabase.from('appointments').select('starts_at').eq('client_id', clientId),
      supabase.from('workout_logs').select('log_date, logged_sets(id)').eq('client_id', clientId).limit(300),
      supabase.from('client_journal').select('entry_date').eq('client_id', clientId).limit(300),
      supabase.from('body_metrics').select('metric_date').eq('client_id', clientId).limit(300),
    ]);
    const exByBlock = {}; (blockEx.data || []).forEach((e) => { (exByBlock[e.block_id] ||= []).push(e); });
    const blockById = Object.fromEntries((blocks.data || []).map((b) => [b.id, { ...b, exercises: exByBlock[b.id] || [] }]));
    setLibrary((blocks.data || []).map((b) => ({ ...b, exercises: exByBlock[b.id] || [] })));

    const dpbByPlan = {}; (dpb.data || []).forEach((r) => { (dpbByPlan[r.plan_id] ||= []).push({ ...r, block: blockById[r.block_id] }); });
    const rec = {}, ovr = {};
    (plans.data || []).forEach((p) => {
      const entry = { plan: p, blocks: (dpbByPlan[p.id] || []).filter((x) => x.block) };
      if (p.plan_date) ovr[p.plan_date] = entry; else if (p.weekday != null) rec[p.weekday] = entry;
    });
    setRecurring(rec); setOverrides(ovr);

    const ev = [];
    (appts.data || []).forEach((a) => ev.push({ date: a.starts_at.slice(0, 10), kind: 'appointment', label: 'Session with trainer' }));
    (logs.data || []).forEach((l) => ev.push({ date: l.log_date, kind: 'session', label: `Logged · ${l.logged_sets?.length || 0} sets` }));
    (journal.data || []).forEach((j) => ev.push({ date: j.entry_date, kind: 'journal', label: 'Journal note' }));
    (metrics.data || []).forEach((mm) => ev.push({ date: mm.metric_date, kind: 'metric', label: 'Check-in' }));
    setEvents(ev);
    setLoading(false);
  }
  useEffect(() => { load(); }, [clientId]);

  const resolveDay = useMemo(() => (dateIso, weekday) => {
    const o = overrides[dateIso];
    if (o) return { count: o.blocks.length, title: o.blocks.map((b) => b.block.name).join(' + ') || 'Rest / custom' };
    const r = recurring[weekday];
    if (r && r.blocks.length) return { count: r.blocks.length, title: r.blocks.map((b) => b.block.name).join(' + ') };
    return null;
  }, [overrides, recurring]);

  const selWeekday = sel ? weekdayOf(sel) : null;
  const override = sel ? overrides[sel] : null;
  const weekly = selWeekday != null ? recurring[selWeekday] : null;
  const active = override || weekly || null;
  const isOverride = !!override;
  const activeBlocks = active?.blocks || [];
  const addedIds = new Set(activeBlocks.map((b) => b.block_id));
  const addable = library.filter((b) => !addedIds.has(b.id));

  useEffect(() => { setMeal(active?.plan?.meal_note || ''); setAddBlockId(''); }, [sel, active?.plan?.id]);

  async function getOrCreateWeekly() {
    if (recurring[selWeekday]?.plan) return recurring[selWeekday].plan;
    const { data } = await supabase.from('day_plans').insert({ client_id: clientId, weekday: selWeekday, title: 'Workout' }).select('*').single();
    await load(); return data;
  }
  async function makeOverride() {
    const w = recurring[selWeekday];
    const { data: plan } = await supabase.from('day_plans').insert({ client_id: clientId, plan_date: sel, title: w?.plan?.title || 'Workout', meal_note: w?.plan?.meal_note || null }).select('*').single();
    if (w?.blocks?.length) {
      await supabase.from('day_plan_blocks').insert(w.blocks.map((b, i) => ({ client_id: clientId, plan_id: plan.id, block_id: b.block_id, sort_order: i })));
    }
    await load();
  }
  async function removeOverride() { if (override) { await supabase.from('day_plans').delete().eq('id', override.plan.id); await load(); } }

  async function addBlockToDay() {
    if (!addBlockId) return;
    let planId = active?.plan?.id;
    if (!planId) { const p = await getOrCreateWeekly(); planId = p.id; }
    await supabase.from('day_plan_blocks').insert({ client_id: clientId, plan_id: planId, block_id: addBlockId, sort_order: activeBlocks.length });
    setAddBlockId(''); load();
  }
  async function removeBlock(dpbId) { await supabase.from('day_plan_blocks').delete().eq('id', dpbId); load(); }
  async function saveMeal() {
    if (!active?.plan?.id) { if (meal.trim()) { const p = await getOrCreateWeekly(); await supabase.from('day_plans').update({ meal_note: meal.trim() }).eq('id', p.id); load(); } return; }
    await supabase.from('day_plans').update({ meal_note: meal.trim() || null }).eq('id', active.plan.id); load();
  }

  return (
    <div className="stack">
      <Calendar events={events} title="Workout calendar" resolveDay={resolveDay} onSelectDay={setSel} />

      {sel && (
        <div className="card">
          <div className="section-header">
            <div>
              <h4 style={{ margin: 0 }}>{new Date(sel).toDateString()}</h4>
              <div className="subtle" style={{ fontSize: 12 }}>{isOverride ? 'Just this day' : `Every ${WD[selWeekday]}`}</div>
            </div>
            <button className="btn btn-ghost" style={{ minHeight: 30 }} onClick={() => setSel(null)}>Close</button>
          </div>

          {/* assigned blocks */}
          {activeBlocks.length === 0 ? (
            <p className="subtle" style={{ margin: '0 0 10px' }}>{readOnly ? 'No blocks on this day.' : 'No blocks yet — add one below.'}</p>
          ) : (
            <div className="stack" style={{ gap: 8, marginBottom: 10 }}>
              {activeBlocks.map((ab) => (
                <div key={ab.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px' }}>
                  <div className="row between" style={{ cursor: 'pointer' }} onClick={() => setOpenBlk((o) => ({ ...o, [ab.id]: !o[ab.id] }))}>
                    <strong>{ab.block.name} <span className="subtle" style={{ fontSize: 12, fontWeight: 400 }}>· {ab.block.exercises.length} exercise{ab.block.exercises.length === 1 ? '' : 's'}</span></strong>
                    <div className="row" style={{ gap: 8 }}>
                      {!readOnly && <button className="btn btn-ghost" style={{ minHeight: 26, padding: '0 8px' }} onClick={(e) => { e.stopPropagation(); removeBlock(ab.id); }}>Remove</button>}
                      <span className="subtle">{openBlk[ab.id] ? '▾' : '▸'}</span>
                    </div>
                  </div>
                  {openBlk[ab.id] && (
                    <div className="stack" style={{ gap: 6, marginTop: 8 }}>
                      {ab.block.exercises.length === 0 ? <p className="subtle" style={{ margin: 0, fontSize: 13 }}>This block has no exercises yet.</p>
                       : ab.block.exercises.map((e) => (
                        <div key={e.id} className="row between" style={{ fontSize: 13 }}>
                          <div>{e.name}<span className="subtle"> {e.target_sets ? `${e.target_sets}×` : ''}{e.target_reps || ''}{e.target_weight ? ` @ ${e.target_weight}kg` : ''}</span></div>
                          <a href={watchUrl(e)} target="_blank" rel="noopener noreferrer" className="badge badge-info" style={{ textDecoration: 'none' }}>▶ Watch</a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {!readOnly && (
            <>
              {/* add a block */}
              {library.length === 0 ? (
                <p className="subtle" style={{ margin: 0 }}>No blocks in your library yet. <ManageLink className="link-inline">Create blocks →</ManageLink></p>
              ) : (
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <select className="select" style={{ flex: 1, minWidth: 160 }} value={addBlockId} onChange={(e) => setAddBlockId(e.target.value)}>
                    <option value="">Add a block…</option>
                    {addable.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <button className="btn btn-secondary" disabled={!addBlockId} onClick={addBlockToDay}>Add block</button>
                  <ManageLink className="btn btn-ghost">Manage blocks</ManageLink>
                </div>
              )}

              {/* per-day meal note */}
              <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
                <label className="label">Meal for this day (optional)</label>
                <input className="input" placeholder="e.g. Refeed day — extra 50g carbs" value={meal} onChange={(e) => setMeal(e.target.value)} onBlur={saveMeal} />
              </div>

              {/* recurring vs one-off */}
              <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                {!isOverride
                  ? <button className="btn btn-ghost" onClick={makeOverride} disabled={!active}>Change just this day</button>
                  : <button className="btn btn-ghost" onClick={removeOverride}>Use the weekly plan instead</button>}
                <span className="subtle" style={{ fontSize: 12, alignSelf: 'center' }}>
                  {isOverride ? 'Changes here apply only to this date.' : `Changes here repeat every ${WD[selWeekday]}.`}
                </span>
              </div>
            </>
          )}

          {readOnly && active?.plan?.meal_note && <p className="subtle" style={{ margin: '8px 0 0' }}>🍽️ {active.plan.meal_note}</p>}
        </div>
      )}

      {loading && <p className="subtle" style={{ fontSize: 12 }}>Syncing…</p>}
    </div>
  );
}
