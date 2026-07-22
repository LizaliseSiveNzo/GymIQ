/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';

const WD = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// Event types: training + three match flavours, each with its own icon and colour.
const TYPES = {
  practice:   { label: 'Training',   icon: '🏃', colour: 'var(--success)' },
  league:     { label: 'League',     icon: '🏆', colour: 'var(--energy)' },
  friendly:   { label: 'Friendly',   icon: '🤝', colour: '#3b82f6' },
  tournament: { label: 'Tournament', icon: '🥇', colour: '#a855f7' },
  event:      { label: 'Event',      icon: '📌', colour: '#0ea5e9' },
  journal:    { label: 'Journal',    icon: '📓', colour: '#f59e0b' },
};

// Derive a match's flavour from its free-text competition field.
function matchType(competition) {
  const c = (competition || '').toLowerCase();
  if (c.includes('friendly')) return 'friendly';
  if (c.includes('tournament') || c.includes('cup') || c.includes('festival')) return 'tournament';
  return 'league';
}

// Month calendar: dots on days with events; tap a day to see its events.
// mode="coach": events open attendance/lineup. mode="player": read-only detail rows.
// teamIds optional — when omitted, RLS scopes the query to the viewer's own team(s).
export default function CoachCalendar({ teamIds, mode = 'coach' }) {
  const navigate = useNavigate();
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all');

  const filterList = Array.isArray(teamIds) ? teamIds : null;
  const ids = (filterList || []).join(',');
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [cursor, ids, mode]);

  async function load() {
    if (filterList && filterList.length === 0) { setEvents([]); return; }
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    let mq = supabase.from('matches').select('id,opponent,date,venue,competition').gte('date', start.toISOString()).lt('date', end.toISOString());
    let sq = supabase.from('training_sessions').select('id,notes,starts_at,location').not('starts_at', 'is', null).gte('starts_at', start.toISOString()).lt('starts_at', end.toISOString());
    let eq = supabase.from('team_events').select('id,title,event_type,starts_at,location').gte('starts_at', start.toISOString()).lt('starts_at', end.toISOString());
    if (filterList) { mq = mq.in('team_id', filterList); sq = sq.in('team_id', filterList); eq = eq.in('team_id', filterList); }

    // journal entries are coach-only; RLS also blocks them for players
    let jq = null;
    if (mode === 'coach') {
      jq = supabase.from('coach_journal_entries')
        .select('id,title,entry_date,category,show_on_calendar')
        .eq('show_on_calendar', true)
        .gte('entry_date', start.toISOString().slice(0, 10))
        .lt('entry_date', end.toISOString().slice(0, 10));
      if (filterList) jq = jq.in('team_id', filterList);
    }

    const [{ data: matches }, { data: sessions }, { data: evts }, jr] = await Promise.all([
      mq, sq, eq, jq || Promise.resolve({ data: [] }),
    ]);
    const journals = jr?.data || [];

    setEvents([
      ...(matches || []).map((m) => ({ type: matchType(m.competition), isMatch: true, id: m.id, when: new Date(m.date), title: 'vs ' + m.opponent, where: m.venue })),
      ...(sessions || []).map((s) => ({ type: 'practice', isMatch: false, id: s.id, when: new Date(s.starts_at), title: s.notes || 'Training', where: s.location })),
      ...(evts || []).map((e) => ({ type: 'event', kind: 'event', id: e.id, when: new Date(e.starts_at), title: e.title, where: e.location, sub: e.event_type })),
      ...journals.map((j) => ({ type: 'journal', kind: 'journal', id: j.id, when: new Date(j.entry_date + 'T09:00:00'), title: j.title, sub: j.category, allDay: true })),
    ]);
    setSelected(null);
  }

  const visible = useMemo(() => events.filter((e) => filter === 'all' || e.type === filter), [events, filter]);

  const byDay = useMemo(() => {
    const m = {};
    visible.forEach((e) => { const k = e.when.getDate(); (m[k] = m[k] || []).push(e); });
    return m;
  }, [visible]);

  const year = cursor.getFullYear(), month = cursor.getMonth();
  const firstWd = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const cells = [];
  for (let i = 0; i < firstWd; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);

  const selectedEvents = selected ? (byDay[selected.getDate()] || []) : [];
  const interactive = mode === 'coach';

  function openEvent(e) {
    if (!interactive) return;
    if (e.kind === 'journal') navigate('/coach/journal');
    else if (e.kind === 'event') navigate('/coach/schedule');
    else if (e.isMatch) navigate('/coach/lineup?match=' + e.id);
    else navigate('/coach/checkin?session=' + e.id);
  }

  const dot = (bg) => <span style={{ width: 6, height: 6, borderRadius: '50%', background: bg }} />;

  // Ring around a date: one solid colour for a single event type, split into
  // halves / thirds / quarters as more types land on the same day.
  const ringFor = (types) => {
    const cols = types.map((t) => TYPES[t]?.colour || 'var(--border)');
    if (cols.length === 1) return cols[0];
    const step = 360 / cols.length;
    const stops = cols.map((c, i) => `${c} ${i * step}deg ${(i + 1) * step}deg`).join(', ');
    return `conic-gradient(${stops})`;
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="row between" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <h4 style={{ margin: 0 }}>📅 Calendar</h4>
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className="btn btn-ghost" style={{ minHeight: 30, padding: '2px 10px' }} onClick={() => setCursor(new Date(year, month - 1, 1))}>‹</button>
          <strong style={{ minWidth: 128, textAlign: 'center' }}>{cursor.toLocaleString([], { month: 'long', year: 'numeric' })}</strong>
          <button type="button" className="btn btn-ghost" style={{ minHeight: 30, padding: '2px 10px' }} onClick={() => setCursor(new Date(year, month + 1, 1))}>›</button>
        </div>
      </div>

      {/* type filter */}
      <div className="row" style={{ gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        <button type="button" className={`badge ${filter === 'all' ? 'badge-neutral' : ''}`}
          onClick={() => setFilter('all')}
          style={{ cursor: 'pointer', border: filter === 'all' ? '1.5px solid var(--green-600)' : '1px solid var(--border)', background: 'transparent' }}>
          All
        </button>
        {Object.entries(TYPES).map(([key, t]) => (
          <button key={key} type="button" onClick={() => setFilter(filter === key ? 'all' : key)}
            className="badge"
            style={{ cursor: 'pointer', background: 'transparent',
              border: filter === key ? `1.5px solid ${t.colour}` : '1px solid var(--border)',
              opacity: filter === 'all' || filter === key ? 1 : .45 }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
        {WD.map((w) => <div key={w} className="subtle" style={{ textAlign: 'center', fontSize: 11, fontWeight: 700 }}>{w}</div>)}
        {cells.map((d, i) => {
          if (d === null) return <div key={'e' + i} />;
          const evs = byDay[d] || [];
          const isToday = sameDay(new Date(year, month, d), today);
          const isSel = selected && selected.getDate() === d;
          const types = [...new Set(evs.map((e) => e.type))];
          const label = types.map((t) => TYPES[t]?.label || t).join(', ');
          return (
            <button key={d} type="button" onClick={() => setSelected(evs.length ? new Date(year, month, d) : null)}
              title={evs.length ? `${evs.length} event${evs.length === 1 ? '' : 's'}: ${label}` : undefined}
              style={{ aspectRatio: '1', border: isSel ? '2px solid var(--green-600)' : '1px solid var(--border)', borderRadius: 8,
                background: isToday ? 'var(--surface-2)' : 'var(--surface)', cursor: evs.length ? 'pointer' : 'default',
                position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
              {types.length > 0 && (
                <>
                  {/* colour ring — split by event type */}
                  <span aria-hidden style={{ position: 'absolute', inset: '9%', borderRadius: '50%', background: ringFor(types) }} />
                  {/* white centre so the date stays readable */}
                  <span aria-hidden style={{ position: 'absolute', inset: '30%', borderRadius: '50%', background: 'var(--surface)' }} />
                </>
              )}
              <span style={{ position: 'relative', fontSize: 12, fontWeight: isToday ? 800 : types.length ? 700 : 500 }}>{d}</span>
            </button>
          );
        })}
      </div>

      {/* legend */}
      <div className="row" style={{ gap: 14, marginTop: 10, fontSize: 12, flexWrap: 'wrap' }}>
        {Object.entries(TYPES).map(([key, t]) => (
          <span key={key} className="row" style={{ gap: 6 }}>{dot(t.colour)} {t.label}</span>
        ))}
      </div>

      {selected && selectedEvents.length > 0 && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <strong style={{ fontSize: 13 }}>{selected.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
          <div className="stack" style={{ gap: 6, marginTop: 8 }}>
            {[...selectedEvents].sort((a, b) => a.when - b.when).map((e, idx) => {
              const time = e.allDay ? 'All day' : e.when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const T = TYPES[e.type] || TYPES.practice;
              const label = (
                <span className="row" style={{ gap: 8 }}>
                  <span style={{ fontSize: 15 }}>{T.icon}</span>
                  <span><strong>{e.title}</strong><span className="subtle" style={{ fontSize: 12 }}> · {time}{e.sub ? ' · ' + e.sub : ''}{e.where ? ' · ' + e.where : ''}</span></span>
                </span>
              );
              const box = { width: '100%', textAlign: 'left', border: '1px solid var(--border)', borderLeft: `3px solid ${T.colour}`, borderRadius: 10, padding: '8px 10px', background: 'var(--surface)' };
              if (interactive) {
                return (
                  <button key={idx} type="button" onClick={() => openEvent(e)} className="row between" style={{ ...box, cursor: 'pointer' }}>
                    {label}
                    <span className="subtle" style={{ fontSize: 12 }}>{e.kind === 'journal' ? '📓 journal' : e.kind === 'event' ? '📌 schedule' : e.isMatch ? '📋 lineup' : '✅ attendance'} ›</span>
                  </button>
                );
              }
              return <div key={idx} className="row between" style={box}>{label}<span className="badge badge-neutral">{T.label}</span></div>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
