/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import TabShell from '../../shell/TabShell.jsx';

const DAYS = [
  { d: 'M', n: 17 }, { d: 'T', n: 18 }, { d: 'W', n: 19 },
  { d: 'T', n: 20 }, { d: 'F', n: 21 }, { d: 'S', n: 22 }, { d: 'S', n: 23 },
];

// WORKOUT tab — week strip + active program (scaffold).
// DayStrip completion states + session launcher: Phase 4. Generator: Phase 3.
export default function WorkoutTab() {
  const todayDow = (new Date().getDay() + 6) % 7; // Monday-first index

  return (
    <TabShell active="workout" title="Workout">
      <div className="daystrip">
        {DAYS.map((day, i) => (
          <div key={i} className={`day-pill ${i === todayDow ? 'today' : ''}`}>
            <span>{day.d}</span>
            <span className="d">{day.n}</span>
            <span className="day-dot" />
          </div>
        ))}
      </div>

      <div className="sec-label">Active program</div>
      <div
        className="mf-card"
        style={{
          minHeight: 170, display: 'flex', flexDirection: 'column',
          alignItems: 'flex-start', justifyContent: 'center',
          textAlign: 'left', borderStyle: 'dashed',
        }}
      >
        <h4>No active program yet</h4>
        <p className="subtle" style={{ marginBottom: 12 }}>
          The generator (goal → focus muscles → days → split) lands in{' '}
          <strong>Phase&nbsp;3</strong>, and the live session player in{' '}
          <strong>Phase&nbsp;4</strong>.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" disabled>Generate my program</button>
          <a className="btn btn-secondary" href="/customer/exercises">Manual blocks (legacy)</a>
        </div>
      </div>

      <div className="sec-label">This week</div>
      <div className="mf-card" style={{ opacity: .75 }}>
        <h4>Workout A–F previews</h4>
        <div className="subtle" style={{ fontSize: 13 }}>
          Once a program exists, each day lists its exercises and muscle chips here.
        </div>
      </div>
    </TabShell>
  );
}
