/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useState } from 'react';
import { NOTE_TAGS, tagColour } from '../lib/noteTags.js';

// Tagged, searchable, filterable coach notes (item 8).
export default function CoachNotes({ notes = [], onAdd, busy }) {
  const [text, setText] = useState('');
  const [tag, setTag] = useState('General');
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');

  const counts = NOTE_TAGS.reduce((acc, [t]) => {
    acc[t] = notes.filter((n) => (n.tag || 'General') === t).length; return acc;
  }, {});

  const shown = notes
    .filter((n) => filter === 'all' || (n.tag || 'General') === filter)
    .filter((n) => (n.note || '').toLowerCase().includes(q.trim().toLowerCase()));

  async function submit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    await onAdd?.(text.trim(), tag);
    setText('');
  }

  const Chip = ({ label, value, colour, n }) => (
    <button type="button" onClick={() => setFilter(filter === value ? 'all' : value)}
      className="badge"
      style={{ cursor: 'pointer', background: 'transparent',
        border: filter === value ? `1.5px solid ${colour}` : '1px solid var(--border)',
        color: filter === value ? colour : 'inherit',
        opacity: filter === 'all' || filter === value ? 1 : .5 }}>
      {label}{n != null ? ` ${n}` : ''}
    </button>
  );

  return (
    <>
      <form className="card" onSubmit={submit}>
        <h4 style={{ marginTop: 0 }}>📝 Add a note</h4>
        <p className="subtle" style={{ fontSize: 13, marginTop: 0 }}>Visible to the player (and their parents on the same login).</p>
        <div className="field" style={{ marginTop: 0 }}>
          <label className="label">Category</label>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {NOTE_TAGS.map(([t, c]) => (
              <button type="button" key={t} onClick={() => setTag(t)} className="badge"
                style={{ cursor: 'pointer', background: tag === t ? c : 'transparent',
                  color: tag === t ? '#fff' : 'inherit',
                  border: `1px solid ${tag === t ? c : 'var(--border)'}` }}>{t}</button>
            ))}
          </div>
        </div>
        <textarea className="textarea" rows={3} placeholder="e.g. Great pressing today. Work on first touch — wall passes 10 min/day."
          value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn btn-primary btn-block" style={{ marginTop: 10 }} disabled={busy || !text.trim()}>Save note</button>
      </form>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-header">
          <h4 style={{ margin: 0 }}>Note history</h4>
          <span className="badge badge-neutral">{shown.length}{shown.length !== notes.length ? ` of ${notes.length}` : ''}</span>
        </div>

        {notes.length > 0 && (
          <>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              <Chip label="All" value="all" colour="var(--green-600)" n={notes.length} />
              {NOTE_TAGS.filter(([t]) => counts[t] > 0).map(([t, c]) => <Chip key={t} label={t} value={t} colour={c} n={counts[t]} />)}
            </div>
            <input className="input" style={{ minHeight: 34, marginBottom: 10 }} placeholder="Search notes…"
              value={q} onChange={(e) => setQ(e.target.value)} />
          </>
        )}

        {notes.length === 0 ? <p className="subtle" style={{ margin: 0 }}>No notes yet.</p>
         : shown.length === 0 ? <p className="subtle" style={{ margin: 0 }}>No notes match that filter.</p>
         : (
          <div className="stack" style={{ gap: 12 }}>
            {shown.map((n) => {
              const t = n.tag || 'General';
              return (
                <div key={n.id} style={{ paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                  <div className="row between" style={{ marginBottom: 4, flexWrap: 'wrap', gap: 6 }}>
                    <span className="badge" style={{ background: tagColour(t), color: '#fff' }}>{t}</span>
                    <span className="subtle" style={{ fontSize: 12 }}>{new Date(n.created_at).toLocaleString()}</span>
                  </div>
                  <p style={{ margin: 0 }}>{n.note}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
