/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const STATUS = {
  not_started: { label: 'Not started', cls: 'badge-neutral' },
  in_progress: { label: 'In progress', cls: 'badge-warning' },
  completed:   { label: 'Completed',   cls: 'badge-success' },
};
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const fmt = (d) => new Date(d).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

// Development plan as a real tracker: goals -> milestones -> progress.
export default function DevelopmentPlan({ playerId, coachId, canEdit = true }) {
  const [goals, setGoals] = useState([]);
  const [ms, setMs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDone, setShowDone] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // new-goal form
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [target, setTarget] = useState('');
  const [msText, setMsText] = useState('');

  // add-milestone inline
  const [msFor, setMsFor] = useState('');
  const [msNew, setMsNew] = useState('');

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [playerId]);

  async function load() {
    setLoading(true);
    try {
      const { data: g } = await supabase.from('development_goals')
        .select('id,title,description,target_date,status,completed_at,created_at')
        .eq('player_id', playerId).order('created_at', { ascending: false });
      setGoals(g || []);
      const ids = (g || []).map((x) => x.id);
      if (ids.length) {
        const { data: m } = await supabase.from('development_milestones')
          .select('id,goal_id,title,done,done_at,sort_order').in('goal_id', ids).order('sort_order');
        setMs(m || []);
      } else setMs([]);
    } finally { setLoading(false); }
  }

  async function addGoal(e) {
    e.preventDefault(); if (!title.trim()) return;
    setBusy(true); setErr('');
    try {
      const { data: g, error } = await supabase.from('development_goals')
        .insert({ player_id: playerId, coach_id: coachId || null, title: title.trim(),
                  description: desc.trim() || null, target_date: target || null })
        .select('id').single();
      if (error) { setErr(error.message); return; }
      const lines = msText.split('\n').map((s) => s.trim()).filter(Boolean);
      if (lines.length) {
        await supabase.from('development_milestones')
          .insert(lines.map((t, i) => ({ goal_id: g.id, title: t, sort_order: i })));
      }
      setTitle(''); setDesc(''); setTarget(''); setMsText(''); setAdding(false);
      await load();
    } finally { setBusy(false); }
  }

  async function toggleMs(m) {
    const done = !m.done;
    setMs((list) => list.map((x) => x.id === m.id ? { ...x, done } : x));
    await supabase.from('development_milestones')
      .update({ done, done_at: done ? new Date().toISOString() : null }).eq('id', m.id);
    // auto-advance goal status from its milestones
    const siblings = ms.filter((x) => x.goal_id === m.goal_id).map((x) => x.id === m.id ? { ...x, done } : x);
    const allDone = siblings.length > 0 && siblings.every((x) => x.done);
    const anyDone = siblings.some((x) => x.done);
    const next = allDone ? 'completed' : anyDone ? 'in_progress' : 'not_started';
    await supabase.from('development_goals')
      .update({ status: next, completed_at: allDone ? new Date().toISOString() : null }).eq('id', m.goal_id);
    setGoals((list) => list.map((g) => g.id === m.goal_id ? { ...g, status: next } : g));
  }

  async function setStatus(goal, status) {
    await supabase.from('development_goals')
      .update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null }).eq('id', goal.id);
    setGoals((list) => list.map((g) => g.id === goal.id ? { ...g, status } : g));
  }

  async function addMilestone(goalId) {
    if (!msNew.trim()) return;
    const order = ms.filter((x) => x.goal_id === goalId).length;
    await supabase.from('development_milestones').insert({ goal_id: goalId, title: msNew.trim(), sort_order: order });
    setMsNew(''); setMsFor(''); await load();
  }

  async function removeGoal(goalId) {
    if (!window.confirm('Delete this development goal and its milestones?')) return;
    await supabase.from('development_goals').delete().eq('id', goalId);
    await load();
  }

  const active = goals.filter((g) => g.status !== 'completed');
  const done = goals.filter((g) => g.status === 'completed');

  const GoalCard = (g) => {
    const mine = ms.filter((x) => x.goal_id === g.id).sort((a, b) => a.sort_order - b.sort_order);
    const doneCount = mine.filter((x) => x.done).length;
    const pct = mine.length ? Math.round(doneCount / mine.length * 100) : (g.status === 'completed' ? 100 : 0);
    const overdue = g.target_date && g.status !== 'completed' && new Date(g.target_date) < today();
    const S = STATUS[g.status] || STATUS.not_started;
    return (
      <div key={g.id} style={{ border: '1px solid var(--border)', borderLeft: `4px solid ${overdue ? 'var(--danger)' : g.status === 'completed' ? 'var(--success)' : 'var(--green-600)'}`, borderRadius: 12, padding: '10px 12px' }}>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div style={{ minWidth: 180 }}>
            <strong>{g.title}</strong>
            {g.description && <div className="subtle" style={{ fontSize: 12.5, marginTop: 2 }}>{g.description}</div>}
            <div className="subtle" style={{ fontSize: 12, marginTop: 3 }}>
              {g.target_date ? <>Target: {fmt(g.target_date)}{overdue && <span style={{ color: 'var(--danger)', fontWeight: 700 }}> · overdue</span>}</> : 'No target date'}
            </div>
          </div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <span className={`badge ${S.cls}`}>{S.label}</span>
            {canEdit && <button type="button" className="btn btn-ghost" style={{ minHeight: 26, padding: '2px 8px', color: 'var(--danger)' }} onClick={() => removeGoal(g.id)}>🗑</button>}
          </div>
        </div>

        {/* progress */}
        <div style={{ marginTop: 8 }}>
          <div className="row between" style={{ fontSize: 11 }}>
            <span className="subtle">{mine.length ? `${doneCount}/${mine.length} milestones` : 'No milestones yet'}</span>
            <span className="subtle">{pct}%</span>
          </div>
          <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden', marginTop: 3 }}>
            <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? 'var(--success)' : 'var(--green-600)', transition: 'width .3s ease' }} />
          </div>
        </div>

        {/* milestones */}
        {mine.length > 0 && (
          <div className="stack" style={{ gap: 4, marginTop: 8 }}>
            {mine.map((m) => (
              <label key={m.id} className="row" style={{ gap: 8, cursor: canEdit ? 'pointer' : 'default', fontSize: 13 }}>
                <input type="checkbox" checked={m.done} disabled={!canEdit} onChange={() => toggleMs(m)} />
                <span style={{ textDecoration: m.done ? 'line-through' : 'none', opacity: m.done ? .6 : 1 }}>{m.title}</span>
              </label>
            ))}
          </div>
        )}

        {canEdit && (
          <div style={{ marginTop: 8 }}>
            {msFor === g.id ? (
              <div className="row" style={{ gap: 6 }}>
                <input className="input" style={{ minHeight: 32, flex: 1 }} placeholder="New milestone" value={msNew}
                  onChange={(e) => setMsNew(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMilestone(g.id); } }} />
                <button type="button" className="btn btn-secondary" style={{ minHeight: 32 }} onClick={() => addMilestone(g.id)}>Add</button>
                <button type="button" className="btn btn-ghost" style={{ minHeight: 32 }} onClick={() => { setMsFor(''); setMsNew(''); }}>✕</button>
              </div>
            ) : (
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-ghost" style={{ minHeight: 28, padding: '2px 8px' }} onClick={() => { setMsFor(g.id); setMsNew(''); }}>＋ Milestone</button>
                {g.status !== 'completed'
                  ? <button type="button" className="btn btn-ghost" style={{ minHeight: 28, padding: '2px 8px' }} onClick={() => setStatus(g, 'completed')}>✓ Mark complete</button>
                  : <button type="button" className="btn btn-ghost" style={{ minHeight: 28, padding: '2px 8px' }} onClick={() => setStatus(g, 'in_progress')}>↩ Reopen</button>}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="section-header">
        <h4 style={{ margin: 0 }}>🎯 Development plan</h4>
        <div className="row" style={{ gap: 6 }}>
          <span className="badge badge-neutral">{active.length} active</span>
          {canEdit && <button type="button" className="btn btn-primary" style={{ minHeight: 30, padding: '4px 10px' }} onClick={() => setAdding((v) => !v)}>{adding ? 'Close' : '＋ Goal'}</button>}
        </div>
      </div>

      {adding && canEdit && (
        <form onSubmit={addGoal} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <div className="field" style={{ marginTop: 0 }}><label className="label">Goal</label>
            <input className="input" placeholder="e.g. Improve weak-foot passing" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="field"><label className="label">Description (optional)</label>
            <textarea className="textarea" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
          <div className="field"><label className="label">Target date (optional)</label>
            <input className="input" type="date" value={target} onChange={(e) => setTarget(e.target.value)} /></div>
          <div className="field"><label className="label">Milestones — one per line (optional)</label>
            <textarea className="textarea" rows={3} placeholder={'e.g.\n10 min wall passes daily\nComplete 20 left-foot passes in a session'} value={msText} onChange={(e) => setMsText(e.target.value)} /></div>
          {err && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</p>}
          <button className="btn btn-primary btn-block" disabled={busy || !title.trim()}>{busy ? 'Saving…' : 'Add goal'}</button>
        </form>
      )}

      {loading ? <p className="subtle" style={{ margin: 0 }}>Loading…</p>
       : goals.length === 0 ? <p className="subtle" style={{ margin: 0 }}>No development goals yet.{canEdit ? ' Add one to start tracking progress.' : ''}</p>
       : (
        <>
          <div className="stack" style={{ gap: 10 }}>{active.map(GoalCard)}</div>
          {active.length === 0 && <p className="subtle" style={{ margin: 0 }}>All goals completed 🎉</p>}
          {done.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <button type="button" className="btn btn-ghost" style={{ minHeight: 30 }} onClick={() => setShowDone((v) => !v)}>
                {showDone ? '▲ Hide' : '▼ Show'} completed ({done.length})
              </button>
              {showDone && <div className="stack" style={{ gap: 10, marginTop: 8 }}>{done.map(GoalCard)}</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
