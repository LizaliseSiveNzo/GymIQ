/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { ATTR_LABEL, groupAverages, overall, topAttrs } from '../lib/attributes.js';

const Stars = ({ n = 0 }) => (
  <span style={{ color: 'var(--warning)', letterSpacing: 1 }}>{'★'.repeat(n)}{'☆'.repeat(5 - n)}</span>
);
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '—');

const DEMO = {
  name: 'Thabo Mokoena', position: 'Winger', strong_foot: 'right', weak_foot: 3, height_cm: 178, weight_kg: 68.5,
  attributes: { acceleration: 5, sprint_speed: 5, finishing: 4, shot_power: 4, long_shots: 3, short_passing: 4,
    vision: 4, crossing: 4, ball_control: 4, agility: 5, balance: 4, tackling: 2, marking: 2, interceptions: 3,
    strength: 3, stamina: 4, jumping: 3 },
};

export default function PlayerCard({ playerId }) {
  const { session } = useAuth();
  const [card, setCard] = useState(session?.demo ? DEMO : null);
  const [loading, setLoading] = useState(!session?.demo);

  useEffect(() => { if (session?.demo) return; (async () => {
    const { data } = await supabase.rpc('player_card', { p_player: playerId ?? null });
    setCard(data); setLoading(false);
  })(); }, [playerId]);

  if (loading) return <div className="card" style={{ marginTop: 18 }}>Loading…</div>;
  if (!card) return null;

  const attrs = card.attributes || {};
  const ov = overall(attrs);
  const groups = groupAverages(attrs);
  const top = topAttrs(attrs);

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <div className="section-header">
        <h4 style={{ margin: 0 }}>⚡ Player Card</h4>
        {ov > 0 && <span className="badge badge-success" style={{ fontSize: 14 }}>OVR {ov}</span>}
      </div>

      <div className="grid grid-4" style={{ gap: 12 }}>
        <div className="kpi"><div className="kpi-label">Strong foot</div><div className="kpi-value" style={{ fontSize: 20 }}>{cap(card.strong_foot)}</div></div>
        <div className="kpi"><div className="kpi-label">Weak foot</div><div className="kpi-value" style={{ fontSize: 15 }}><Stars n={card.weak_foot || 0} /></div></div>
        <div className="kpi"><div className="kpi-label">Height</div><div className="kpi-value" style={{ fontSize: 20 }}>{card.height_cm ? `${card.height_cm}cm` : '—'}</div></div>
        <div className="kpi"><div className="kpi-label">Weight</div><div className="kpi-value" style={{ fontSize: 20 }}>{card.weight_kg ? `${card.weight_kg}kg` : '—'}</div></div>
      </div>

      {top.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="subtle" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>Strongest attributes</div>
          <div className="row" style={{ gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            {top.map(([k, v]) => <span key={k} className="badge badge-success">{ATTR_LABEL[k] || k} · {v}</span>)}
          </div>
        </div>
      )}

      {ov > 0 ? (
        <div style={{ marginTop: 14 }} className="stack">
          {groups.map(([g, avg]) => (
            <div key={g}>
              <div className="row between" style={{ fontSize: 13 }}><span>{g}</span><strong>{avg ? avg.toFixed(1) : '—'}</strong></div>
              <div className="progress"><span style={{ width: `${(avg / 5) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      ) : <p className="subtle" style={{ margin: '12px 0 0' }}>No attribute ratings yet — your coach will rate these.</p>}
    </div>
  );
}
