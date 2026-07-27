/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useMemo, useState } from 'react';

// Reusable month calendar.
// events: [{ date: 'YYYY-MM-DD', label, kind }]  kind: appointment|session|journal|metric
const KIND = {
  appointment: { color: 'var(--green-600)', label: 'Session booked' },
  session:     { color: 'var(--info)',      label: 'Workout logged' },
  journal:     { color: 'var(--warning)',   label: 'Journal note' },
  metric:      { color: 'var(--success)',   label: 'Check-in' },
};
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export default function Calendar({ events = [], title = 'Calendar' }) {
  const today = new Date();
  const [y, setY] = useState(today.getFullYear());
  const [m, setM] = useState(today.getMonth());
  const [sel, setSel] = useState(null);

  const byDay = useMemo(() => {
    const map = {};
    for (const e of events) { (map[e.date] ||= []).push(e); }
    return map;
  }, [events]);

  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);

  const prev = () => { const nm = m - 1; if (nm < 0) { setM(11); setY(y - 1); } else setM(nm); setSel(null); };
  const next = () => { const nm = m + 1; if (nm > 11) { setM(0); setY(y + 1); } else setM(nm); setSel(null); };

  const todayIso = iso(today.getFullYear(), today.getMonth(), today.getDate());
  const kindsInMonth = new Set(events.filter((e) => e.date.startsWith(`${y}-${String(m + 1).padStart(2, '0')}`)).map((e) => e.kind));
  const selEvents = sel ? (byDay[sel] || []) : [];

  return (
    <div className="card">
      <div className="section-header" style={{ marginBottom: 12 }}>
        <h4 style={{ margin: 0 }}>{title}</h4>
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className="btn btn-ghost" style={{ minHeight: 30, padding: '2px 10px' }} onClick={prev}>‹</button>
          <span style={{ fontWeight: 600, minWidth: 130, textAlign: 'center' }}>{MONTHS[m]} {y}</span>
          <button type="button" className="btn btn-ghost" style={{ minHeight: 30, padding: '2px 10px' }} onClick={next}>›</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
        {DOW.map((d, i) => <div key={i} className="subtle" style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, padding: '2px 0' }}>{d}</div>)}
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const dayIso = iso(y, m, d);
          const evs = byDay[dayIso] || [];
          const isToday = dayIso === todayIso;
          const isSel = dayIso === sel;

          // Ring reflects WORKOUTS that day: 1=quarter, 2=half, 3=three-quarter, 4+=full.
          const workouts = evs.filter((e) => e.kind === 'appointment' || e.kind === 'session');
          const frac = Math.min(workouts.length, 4) / 4;
          const ringColor = evs.some((e) => e.kind === 'appointment') ? KIND.appointment.color : KIND.session.color;
          const R = 15, C = 2 * Math.PI * R;
          // other kinds (journal / check-in) shown as a small corner dot
          const otherKind = evs.find((e) => e.kind === 'journal' || e.kind === 'metric')?.kind;

          return (
            <button
              key={i}
              type="button"
              onClick={() => setSel(isSel ? null : dayIso)}
              style={{
                position: 'relative', aspectRatio: '1 / 1', minHeight: 44, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, fontSize: 13,
                background: isSel ? 'var(--green-100)' : 'transparent',
                border: `1px solid ${isToday ? 'var(--green-600)' : 'var(--border)'}`,
                color: 'var(--ink)', fontWeight: isToday ? 700 : 400,
              }}
            >
              {frac > 0 && (
                <svg viewBox="0 0 40 40" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                  <circle cx="20" cy="20" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="2.5" />
                  <circle cx="20" cy="20" r={R} fill="none" stroke={ringColor} strokeWidth="3" strokeLinecap="round"
                    strokeDasharray={C} strokeDashoffset={C * (1 - frac)} transform="rotate(-90 20 20)" />
                </svg>
              )}
              {otherKind && (
                <span style={{ position: 'absolute', top: 4, right: 4, width: 6, height: 6, borderRadius: '50%', background: (KIND[otherKind] || {}).color }} />
              )}
              <span style={{ position: 'relative' }}>{d}</span>
            </button>
          );
        })}
      </div>

      {/* legend for kinds present this month */}
      {kindsInMonth.size > 0 && (
        <div className="row" style={{ gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
          {[...kindsInMonth].map((k) => (
            <span key={k} className="row subtle" style={{ gap: 5, fontSize: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: (KIND[k] || {}).color }} />{(KIND[k] || {}).label || k}
            </span>
          ))}
        </div>
      )}
      <p className="subtle" style={{ fontSize: 11, margin: '8px 0 0' }}>The ring around each date fills up as more workouts are booked or logged that day (¼ → ½ → ¾ → full).</p>

      {/* selected day's events */}
      {sel && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <div className="subtle" style={{ fontSize: 12, marginBottom: 6 }}>{new Date(sel).toDateString()}</div>
          {selEvents.length === 0 ? <p className="subtle" style={{ margin: 0, fontSize: 13 }}>Nothing on this day.</p> : (
            <div className="stack" style={{ gap: 6 }}>
              {selEvents.map((e, i) => (
                <div key={i} className="row" style={{ gap: 8, fontSize: 13 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: (KIND[e.kind] || {}).color, flexShrink: 0 }} />
                  {e.label}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
