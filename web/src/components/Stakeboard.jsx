/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useState } from 'react';

const initials = (n = '') => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const MEDALS = ['🥇', '🥈', '🥉'];
const one = (v) => Number(v || 0).toFixed(1);

// Ranked player rows; tapping a player reveals a clean stat summary right under that row.
export default function Stakeboard({ rows, metric, C }) {
  const [openId, setOpenId] = useState(null);
  const redAvatar = { width: 40, height: 40, borderRadius: '50%', background: C.red, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 };
  const gold = C.gold || '#F5C518';

  const Stars = ({ v }) => {
    const n = Math.round(Number(v || 0));
    return <span style={{ fontSize: 20, letterSpacing: 2 }}>{[1, 2, 3, 4, 5].map((i) => <span key={i} style={{ color: i <= n ? gold : '#3a3f4a' }}>★</span>)}</span>;
  };

  const Tile = ({ label, value }) => (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 800 }}>{value}</div>
      <div style={{ color: C.muted, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.03em', fontWeight: 700, marginTop: 2 }}>{label}</div>
    </div>
  );

  function tilesFor(r) {
    const t = [
      ['Goals', r.tot_goals ?? 0],
      ['Assists', r.tot_assists ?? 0],
      ['G + A', r.tot_goal_contributions ?? 0],
      ['Pass %', `${Math.round(r.pass_accuracy || 0)}%`],
      ['Ball carries', `${one(r.avg_ball_carries)}/g`],
      ['Def actions', `${one(r.avg_def_contributions)}/g`],
      ['Key passes', `${one(r.avg_key_passes)}/g`],
      ['Aerials', `${one(r.avg_aerials_won)}/g`],
    ];
    if ((r.avg_saves || 0) > 0 || (r.tot_clean_sheets || 0) > 0) {
      t.push(['Saves', `${one(r.avg_saves)}/g`], ['Clean sheets', r.tot_clean_sheets ?? 0]);
    }
    if ((r.tot_yellow_cards || 0) > 0 || (r.tot_red_cards || 0) > 0) {
      t.push(['Cards', `${r.tot_yellow_cards || 0}🟨 ${r.tot_red_cards || 0}🟥`]);
    }
    return t;
  }

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

            {/* Summary panel, animated open/close */}
            <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows .38s ease', overflow: 'hidden' }}>
              <div style={{ minHeight: 0 }}>
                <div style={{ background: C.card2, border: `1px solid ${C.red}`, borderRadius: 12, padding: 14, margin: '8px 0 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800 }}>{r.name}</div>
                      <div style={{ color: C.muted, fontSize: 12 }}>{[r.play_position, r.team_name, `${r.games} games`, (r.rank_level || 'Rookie').replace('_', ' ')].filter(Boolean).join(' · ')}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <Stars v={r.avg_rating} />
                      <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{Number(r.avg_rating || 0).toFixed(2)}<span style={{ color: C.muted, fontSize: 12, fontWeight: 600 }}> avg</span></div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 14, margin: '12px 0', color: C.muted, fontSize: 13 }}>
                    <span>⏱ {r.tot_minutes ?? 0} min</span>
                    <span>🎯 {one(r.avg_shots_on_target)} SoT/g</span>
                    <span>🏃 {one(r.avg_dribbles)} dribbles/g</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(96px,1fr))', gap: 8 }}>
                    {tilesFor(r).map(([label, value], idx) => (
                      <div key={label} style={{ opacity: open ? 1 : 0, transform: open ? 'translateX(0)' : 'translateX(28px)',
                        transition: 'opacity .35s ease, transform .35s ease', transitionDelay: open ? `${idx * 0.04}s` : '0s' }}>
                        <Tile label={label} value={value} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
