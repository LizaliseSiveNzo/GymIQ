/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';

const initials = (n = '') => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const chip = { background: 'rgba(255,255,255,.14)', color: '#fff' };

const DEMO = {
  player_of_week: { name: 'Thabo Mokoena', team: 'U15', position: 'Winger', score: 71, avg_rating: 4.8, goals: 2, assists: 1, attendance: 3, rank: 'Elite' },
  motm: [
    { opponent: 'Rivera FC', date: new Date(Date.now() - 2 * 86400e3).toISOString(), player_name: 'Thabo Mokoena', rating: 4.8 },
    { opponent: 'Coastal Academy', date: new Date(Date.now() - 9 * 86400e3).toISOString(), player_name: 'Lerato Khumalo', rating: 4.6 },
  ],
};

export default function WeeklyHighlights() {
  const { session } = useAuth();
  const [data, setData] = useState(session?.demo ? DEMO : null);
  const [loading, setLoading] = useState(!session?.demo);

  useEffect(() => { if (session?.demo) return;
    supabase.rpc('weekly_highlights').then(({ data }) => { setData(data); setLoading(false); });
  }, []);

  if (loading) return <div className="card" style={{ marginBottom: 16 }}>Loading highlights…</div>;
  const potw = data?.player_of_week;
  const motm = data?.motm || [];

  return (
    <>
      <div className="card" style={{ background: 'linear-gradient(135deg, var(--navy-900), var(--navy-700))', color: '#fff', marginBottom: 16 }}>
        <div className="lp-eyebrow" style={{ color: 'var(--energy)' }}>⭐ Player of the Week</div>
        {potw ? (
          <>
            <div className="row between" style={{ marginTop: 10, flexWrap: 'wrap', gap: 12 }}>
              <div className="row" style={{ gap: 14 }}>
                <span className="avatar" style={{ width: 56, height: 56, fontSize: 18, background: 'var(--energy)', color: '#04140b' }}>{initials(potw.name)}</span>
                <div>
                  <h2 style={{ margin: 0, color: '#fff' }}>{potw.name}</h2>
                  <div style={{ color: '#C7D2E1' }}>{[potw.team, potw.position].filter(Boolean).join(' · ') || '—'}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 34 }}>{potw.score}</div>
                <div style={{ color: '#C7D2E1', fontSize: 12 }}>week score</div>
              </div>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <span className="badge" style={chip}>⭐ {potw.avg_rating} avg</span>
              <span className="badge" style={chip}>⚽ {potw.goals} goals</span>
              <span className="badge" style={chip}>🅰 {potw.assists} assists</span>
              <span className="badge" style={chip}>✅ {potw.attendance} sessions</span>
              <span className="badge" style={chip}>{(potw.rank || 'Rookie').replace('_', ' ')}</span>
            </div>
          </>
        ) : <p style={{ color: '#C7D2E1', margin: '8px 0 0' }}>No standout yet this week — log a match and someone gets crowned!</p>}
      </div>

      {motm.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header"><h4 style={{ margin: 0 }}>🏅 Man of the Match — recent fixtures</h4></div>
          <div className="stack" style={{ gap: 10 }}>
            {motm.map((m, i) => (
              <div key={i} className="row between" style={{ paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                <div><strong>{m.player_name || '—'}</strong>
                  <div className="subtle" style={{ fontSize: 13 }}>vs {m.opponent} · {new Date(m.date).toLocaleDateString()}</div></div>
                <span className="badge badge-warning">⭐ {m.rating ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
