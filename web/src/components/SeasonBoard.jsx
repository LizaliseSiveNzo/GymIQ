/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useState } from 'react';
import PlayerStatSummary from './PlayerStatSummary.jsx';

const initials = (n = '') => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const MEDALS = ['🥇', '🥈', '🥉'];

export default function SeasonBoard({ season, statsById, C }) {
  const [openPos, setOpenPos] = useState(null);
  const redAvatar = { width: 40, height: 40, borderRadius: '50%', background: C.red, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 };

  return (
    <div>
      {season.map((r) => {
        const open = openPos === r.pos;
        const stat = r.player_id ? statsById[r.player_id] : null;
        return (
          <div key={r.pos}>
            <button type="button" onClick={() => setOpenPos(open ? null : r.pos)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 8px',
                background: r.me ? 'rgba(228,3,46,.10)' : 'transparent', border: 'none', borderBottom: `1px solid ${C.border}`,
                borderRadius: r.me ? 10 : 0, color: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <span style={{ width: 30, textAlign: 'center', fontSize: MEDALS[r.pos - 1] ? 20 : 14, fontWeight: 800, color: MEDALS[r.pos - 1] ? undefined : C.muted }}>{MEDALS[r.pos - 1] || `#${r.pos}`}</span>
                <span style={redAvatar}>{initials(r.name)}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{r.name}{r.me ? ' (you)' : ''}</div>
                  <div style={{ color: C.muted, fontSize: 12 }}>{r.position || '—'} · {(r.rank || 'Rookie').replace('_', ' ')}</div>
                </div>
              </div>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <strong style={{ color: C.red, fontSize: 18, whiteSpace: 'nowrap' }}>{r.score} pts</strong>
                <span style={{ color: open ? C.red : C.muted, fontSize: 18, transition: 'transform .3s ease', transform: open ? 'rotate(90deg)' : 'none' }}>‹</span>
              </span>
            </button>
            <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows .38s ease', overflow: 'hidden' }}>
              <div style={{ minHeight: 0 }}>
                {stat ? <PlayerStatSummary r={stat} C={C} open={open} />
                  : <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, margin: '8px 0 12px', color: C.muted }}>
                      No match stats logged yet · {r.position || '—'} · {(r.rank || 'Rookie').replace('_', ' ')} · {r.score} season points
                    </div>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
