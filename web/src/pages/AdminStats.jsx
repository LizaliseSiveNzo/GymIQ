/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import { supabase } from '../lib/supabaseClient.js';

export default function AdminStats() {
  const [rows, setRows] = useState([]);
  useEffect(() => { supabase.rpc('admin_player_stats').then(({ data }) => setRows(data || [])); }, []);
  return (
    <AppShell role="admin" active="Stats" title="Player Stats">
      <div className="card">
        <div className="section-header"><h4 style={{ margin: 0 }}>All players</h4><span className="badge badge-neutral">{rows.length}</span></div>
        {rows.length === 0 ? <p className="subtle">No players yet.</p> : (
          <table className="table"><thead><tr><th>Player</th><th>Team</th><th>Pos</th><th>Rank</th><th>Attend.</th><th>Games</th><th>Minutes</th><th>Avg rating</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.player_id}>
                <td><Link to={`/admin/player/${r.player_id}`} style={{ color: 'inherit' }}><span style={{ textDecoration: 'underline', fontWeight: 600 }}>{r.name}</span></Link><div className="subtle" style={{ fontSize: 11 }}>{r.email}</div></td>
                <td>{r.team_name || '—'}</td>
                <td>{r.play_position || '—'}</td>
                <td><span className="badge badge-neutral">{(r.rank_level || 'Rookie').replace('_',' ')}</span></td>
                <td>{r.attendance_pct}%</td>
                <td>{r.games}</td>
                <td>{r.minutes}</td>
                <td>{r.avg_rating || '—'}</td>
              </tr>))}</tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
