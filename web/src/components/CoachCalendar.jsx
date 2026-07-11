/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';

const WD = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// Month calendar: dots on days with training (green) / matches (red); tap a day to see + open its events.
export default function CoachCalendar({ teamIds = [] }) {
  const navigate = useNavigate();
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState(null);

  const ids = teamIds.join(',');
  useEffect(() => { if (teamIds.length) load(); else setEvents([]); /* eslint-disable-next-line */ }, [cursor, ids]);

  async function load() {
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    const [{ data: matches }, { data: sessions }] = await Promise.all([
      supabase.from('matches').select('id,opponent,date').in('team_id', teamIds).gte('date', start.toISOString()).lt('date', end.toISOString()),
      supabase.from('training_sessions').select('id,notes,starts_at').in('team_id', teamIds).not('starts_at', 'is', null).gte('starts_at', start.toISOString()).lt('starts_at', end.toISOString()),
    ]);
    setEvents([
      ...(matches || []).map((m) => ({ type: 'match', id: m.id, when: new Date(m.date), title: `vs ${m.opponent}` })),
      ...(sessions || []).map((s) => ({ type: 'practice', id: s.id, when: new Date(s.starts_at), title: s.notes || 'Training' })),
    ]);
    setSelected(null);
  }

  const byDay = useMemo(() => {
    const m = {};
    events.forEach((e) => { const k = e.when.getDate(); (m[k] = m[k] || []).push(e); });
    return m;
  }, [events]);

  const year = cursor.getFullYear(), month = cursor.getMonth();
  const firstWd = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const cells = [];
  for (let i = 0; i < firstWd; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);

  const selectedEvents = selected ? (byDay[selected.getDate()] || []) : [];

  function openEvent(e) {
    if (e.type === 'practice') navigate(`/coach/checkin?session=${e.id}`);
    else navigate(`/coach/lineup?match=${e.id}`);
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="row between" style={{ marginBottom: 10 }}>
        <h4 style={{ margin: 0 }}>📅 Calendar</h4>
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className="btn btn-ghost" style={{ minHeight: 30, padding: '2px 10px' }} onClick={() => setCursor(new Date(year, month - 1, 1))}>‹</button>
          <strong style={{ minWidth: 128, textAlign: 'center' }}>{cursor.toLocaleString([], { month: 'long', year: 'numeric' })}</strong>
          <button type="button" className="btn btn-ghost" style={{ minHeight: 30, padding: '2px 10px' }} onClick={() => setCursor(new Date(year, month + 1, 1))}>›</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
        {WD.map((w) => <div key={w} className="subtle" style={{ textAlign: 'center', fontSize: 11, fontWeight: 700 }}>{w}</div>)}
        {cells.map((d, i) => {
          if (d === null) return <div key={'e' + i} />;
          const evs = byDay[d] || [];
          const isToday = sameDay(new Date(year, month, d), today);
          const isSel = selected && selected.getDate() === d;
          const hasMatch = evs.some((e) => e.type === 'match');
          const hasPractice = evs.some((e) => e.type === 'practice');
          return (
            <button key={d} type="button" onClick={() => setSelected(evs.length ? new Date(year, month, d) : null)}
              style={{ aspectRatio: '1', border: isSel ? '2px solid var(--green-600)' : '1px solid var(--border)', borderRadius: 8,
                background: isToday ? 'var(--surface-2)' : 'var(--surface)', cursor: evs.length ? 'pointer' : 'default',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: 0 }}>
              <span style={{ fontSize: 12, fontWeight: isToday ? 800 : 500 }}>{d}</span>
              <span className="row" style={{ gap: 3, height: 6 }}>
                {hasPractice && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />}
                {hasMatch && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--energy)' }} />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="row" style={{ gap: 16, marginTop: 10, fontSize: 12 }}>
        <span className="row" style={{ gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} /> Training</span>
        <span className="row" style={{ gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--energy)' }} /> Match</span>
      </div>

      {selected && selectedEvents.length > 0 && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <strong style={{ fontSize: 13 }}>{selected.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
          <div className="stack" style={{ gap: 6, marginTop: 8 }}>
            {[...selectedEvents].sort((a, b) => a.when - b.when).map((e, idx) => (
              <button key={idx} type="button" onClick={() => openEvent(e)} className="row between"
                style={{ width: '100%', textAlign: 'left', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', background: 'var(--surface)', cursor: 'pointer' }}>
                <span className="row" style={{ gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: e.type === 'match' ? 'var(--energy)' : 'var(--success)' }} />
                  <span><strong>{e.title}</strong><span className="subtle" style={{ fontSize: 12 }}> · {e.when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></span>
                </span>
                <span className="subtle" style={{ fontSize: 12 }}>{e.type === 'match' ? '📋 lineup' : '✅ attendance'} ›</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
