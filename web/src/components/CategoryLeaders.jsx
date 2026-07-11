/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useRef, useState } from 'react';

const initials = (n = '') => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const MEDALS = ['🥇', '🥈', '🥉'];

// Category tiles; swiping a tile left (or tapping) reveals its top 5 directly beneath it.
export default function CategoryLeaders({ items, stats, C, topN = 5, animateIn = false }) {
  const [openKey, setOpenKey] = useState(null);
  const startX = useRef(0);

  const sortedBy = (key) => [...stats].filter((x) => Number(x[key]) > 0).sort((a, b) => Number(b[key]) - Number(a[key]));

  function onStart(e) { startX.current = e.touches[0].clientX; }
  function onEnd(key, e) {
    const dx = e.changedTouches[0].clientX - startX.current;
    if (dx < -40) setOpenKey(key);
    else if (dx > 40) setOpenKey((k) => (k === key ? null : k));
  }

  const redAvatar = { width: 40, height: 40, borderRadius: '50%', background: C.red, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 };

  return (
    <>
    <style>{`@keyframes clFade{from{opacity:0}to{opacity:1}}`}</style>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
      {items.map((t, idx) => {
        const open = openKey === t.key;
        const ranked = sortedBy(t.key);
        const top = ranked[0];
        const list = ranked.slice(0, topN);
        return (
          <div key={t.key} style={{ display: 'contents' }}>
            <button type="button"
              onClick={() => setOpenKey((k) => (k === t.key ? null : t.key))}
              onTouchStart={onStart} onTouchEnd={(e) => onEnd(t.key, e)}
              style={{ textAlign: 'left', background: C.card2, border: `1px solid ${open ? C.red : C.border}`, borderRadius: 12,
                padding: 14, display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer', color: 'inherit',
                transition: 'transform .28s ease, border-color .28s ease, box-shadow .28s ease',
                transform: open ? 'translateX(-8px)' : 'none', boxShadow: open ? `0 0 0 1px ${C.red} inset` : 'none',
                animation: animateIn ? 'clFade .5s ease both' : undefined, animationDelay: animateIn ? `${idx * 0.06}s` : undefined }}>
              <span style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(228,3,46,.12)', color: C.red, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{t.icon}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ color: C.muted, fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', fontWeight: 700 }}>{t.label}</div>
                {top ? <><div style={{ fontWeight: 700, fontSize: 16 }}>{top.name}</div>
                  <div style={{ color: C.red, fontWeight: 700, fontSize: 13 }}>{t.fmt(top[t.key])}{t.unit ? ` ${t.unit}` : ''}</div></>
                  : <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>No data yet</div>}
              </div>
              <span style={{ color: open ? C.red : C.muted, fontSize: 20, transition: 'transform .3s ease', transform: open ? 'rotate(90deg)' : 'none' }}>‹</span>
            </button>

            {/* Full-width top-5 panel that drops in directly under this tile */}
            <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateRows: open ? '1fr' : '0fr',
              transition: 'grid-template-rows .38s ease, margin-top .38s ease', overflow: 'hidden', marginTop: open ? -2 : 0 }}>
              <div style={{ minHeight: 0 }}>
                <div style={{ background: C.card2, border: `1px solid ${C.red}`, borderRadius: 12, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <strong style={{ fontSize: 14 }}><span style={{ marginRight: 8 }}>{t.icon}</span>{t.label} — Top 5</strong>
                    <button type="button" onClick={() => setOpenKey(null)} style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 18 }}>✕</button>
                  </div>
                  {list.length === 0 ? <p style={{ color: C.muted, margin: 0 }}>No data yet.</p> : list.map((r, i) => (
                    <div key={r.player_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 2px',
                      borderTop: i ? `1px solid ${C.border}` : 'none',
                      opacity: open ? 1 : 0, transform: open ? 'translateX(0)' : 'translateX(34px)',
                      transition: 'opacity .35s ease, transform .35s ease', transitionDelay: open ? `${i * 0.06}s` : '0s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <span style={{ width: 26, textAlign: 'center', fontWeight: 800, fontSize: MEDALS[i] ? 18 : 13, color: MEDALS[i] ? undefined : C.muted }}>{MEDALS[i] || `#${i + 1}`}</span>
                        <span style={redAvatar}>{initials(r.name)}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700 }}>{r.name}</div>
                          <div style={{ color: C.muted, fontSize: 12 }}>{r.team_name || '—'} · {r.games} games</div>
                        </div>
                      </div>
                      <strong style={{ color: C.red, fontSize: 18, whiteSpace: 'nowrap' }}>{t.fmt(r[t.key])}{t.unit ? ` ${t.unit}` : ''}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
    </>
  );
}
