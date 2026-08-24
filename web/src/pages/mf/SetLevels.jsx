/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useState } from 'react';
import TabShell from '../../shell/TabShell.jsx';

const WINDOWS = [7, 14, 28];
const MUSCLES = ['Chest', 'Upper Back', 'Lats', 'Biceps', 'Triceps', 'Front Delts', 'Side Delts',
  'Rear Delts', 'Abs', 'Quads', 'Hamstrings', 'Glutes', 'Calves'];

// LEVELS — weekly volume per muscle on a body map (scaffold).
// Fractional-volume SQL view + SVG body map: Phase 6 (needs catalog v2 from Phase 1).
export default function SetLevels() {
  const [win, setWin] = useState(7);

  return (
    <TabShell active="levels" title="Set Levels">
      <div className="chiprow">
        {WINDOWS.map((w) => (
          <button key={w} className={`chip ${w === win ? 'on' : ''}`} onClick={() => setWin(w)}>
            Avg weekly sets · {w}-day
          </button>
        ))}
      </div>

      <div
        className="mf-card"
        style={{
          marginTop: 14, minHeight: 260, display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', borderStyle: 'dashed',
        }}
      >
        <div style={{ fontSize: 42, marginBottom: 6 }}>🧍</div>
        <h4>Complete workouts to see your Set Levels</h4>
        <p className="subtle" style={{ maxWidth: 320, marginBottom: 0 }}>
          The anatomical body map fills per muscle as you train. Arrives in{' '}
          <strong>Phase&nbsp;6</strong>, powered by fractional muscle credits.
        </p>
      </div>

      <div className="list-section">
        <div className="sec-label">Upper body levels</div>
        <div className="list-card">
          {MUSCLES.filter((m) => !['Quads', 'Hamstrings', 'Glutes', 'Calves'].includes(m)).map((m) => (
            <div key={m} className="list-row">
              <span className="grow">{m}</span>
              <span className="subtle">— sets</span>
            </div>
          ))}
        </div>
      </div>

      <div className="list-section">
        <div className="sec-label">Lower body levels</div>
        <div className="list-card">
          {['Quads', 'Hamstrings', 'Glutes', 'Calves'].map((m) => (
            <div key={m} className="list-row">
              <span className="grow">{m}</span>
              <span className="subtle">— sets</span>
            </div>
          ))}
        </div>
      </div>
    </TabShell>
  );
}
