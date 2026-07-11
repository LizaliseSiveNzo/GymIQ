/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useState } from 'react';
import PlayerStatSummary from './PlayerStatSummary.jsx';

const initials = (n = '') => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const MEDALS = ['🥇', '🥈', '🥉'];

export default function Stakeboard({ rows, metric, C }) {
  const [openId, setOpenId] = useState(null);
  const redAvatar = { width: 40, height: 40, borderRadius: '50%', background: C.red, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 };

  return (
    <div>
      {rows.map((r, i) => {
        const open = openId === r.player_id;
        return (
          <div key={r.player_id}>
            <button type="button" onClick={() => setOpenId(open ? null : r.player_id)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 4px',
                background: 'transparent', border: 'none', borderBottom: `1px solid ${C.border}`, color: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <span style={{ width: 30, textAlign: 'center', fontSize: MEDALS[i] ? 20 : 14, fontWeight: 800, color: MEDALS[i] ? undefined : C.muted }}>{MEDALS[i] || `#${i + 1}`}</span>
                <span style={redAvatar}>{initials(r.name)}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{r.name}</div>
                  <div style={{ color: C.muted, fontSize: 12 }}>{r.team_name || '—'} · Played {r.games} games</div>
                </div>
              </div>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <strong style={{ color: C.red, fontSize: 20, whiteSpace: 'nowrap' }}>{metric.fmt(r[metric.key])}</strong>
                <span style={{ color: open ? C.red : C.muted, fontSize: 18, transition: 'transform .3s ease', transform: open ? 'rotate(90deg)' : 'none' }}>‹</span>
              </span>
            </button>
            <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows .38s ease', overflow: 'hidden' }}>
              <div style={{ minHeight: 0 }}><PlayerStatSummary r={r} C={C} open={open} /></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
