/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';

const DEMO = [
  { opponent: 'Rivera FC', date: new Date(Date.now() - 4 * 86400e3).toISOString(), result: '2-1', minutes_played: 90, goals: 1, assists: 1, rating: 4.6 },
  { opponent: 'Coastal Academy', date: new Date(Date.now() - 11 * 86400e3).toISOString(), result: '0-0', minutes_played: 62, goals: 0, assists: 0, rating: 3.9 },
  { opponent: 'Metro United', date: new Date(Date.now() - 18 * 86400e3).toISOString(), result: '3-2', minutes_played: 20, goals: 0, assists: 1, rating: 4.1 },
];

// Game-by-game minutes and stats. Pass playerId for the coach view; omit on the player's own profile.
export default function MatchLog({ playerId, title = 'Minutes per game' }) {
  const { session } = useAuth();
  const [rows, setRows] = useState(session?.demo ? DEMO : []);
  const [loading, setLoading] = useState(!session?.demo);

  useEffect(() => { if (session?.demo) return; (async () => {
    const { data } = await supabase.rpc('player_match_log', { p_player: playerId ?? null });
    setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  })(); }, [playerId]);

  const totalMin = rows.reduce((n, r) => n + (r.minutes_played || 0), 0);
  const avgMin = rows.length ? Math.round(totalMin / rows.length) : 0;

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <div className="section-header">
        <h4 style={{ margin: 0 }}>⏱️ {title}</h4>
        {rows.length > 0 && <span className="badge badge-neutral">{totalMin} min · avg {avgMin}/game</span>}
      </div>
      {loading ? <p className="subtle" style={{ margin: 0 }}>Loading…</p>
        : rows.length === 0 ? <p className="subtle" style={{ margin: 0 }}>No matches logged yet.</p>
        : (
          <table className="table">
            <thead><tr><th>Date</th><th>Opponent</th><th>Result</th><th>Minutes</th><th>G</th><th>A</th><th>Rating</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{new Date(r.date).toLocaleDateString()}</td>
                  <td>{r.opponent}{r.venue ? ` (${r.venue})` : ''}</td>
                  <td>{r.result || '—'}</td>
                  <td><strong>{r.minutes_played ?? 0}'</strong></td>
                  <td>{r.goals ?? 0}</td>
                  <td>{r.assists ?? 0}</td>
                  <td>{r.rating ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </div>
  );
}
