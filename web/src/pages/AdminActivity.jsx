/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import { supabase } from '../lib/supabaseClient.js';

const fmt = (iso) => iso ? new Date(iso).toLocaleString() : '—';

export default function AdminActivity() {
  const [tab, setTab] = useState('training');
  const [log, setLog] = useState([]);
  const [matches, setMatches] = useState([]);
  const [openId, setOpenId] = useState('');
  const [roster, setRoster] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { load(); }, []);
  async function load() {
    const [{ data: l }, { data: m }] = await Promise.all([
      supabase.rpc('admin_training_log'),
      supabase.rpc('admin_matches'),
    ]);
    setLog(l || []); setMatches(m || []);
  }

  async function toggleOpen(sid) {
    if (openId === sid) { setOpenId(''); setRoster([]); return; }
    setOpenId(sid);
    const { data } = await supabase.rpc('session_attendance', { p_session_id: sid });
    setRoster(data || []);
  }

  async function setPresent(sid, playerId, present) {
    setBusy(true); setErr('');
    const { error } = await supabase.rpc('admin_set_attendance', { p_session_id: sid, p_player_id: playerId, p_present: present });
    if (error) { setErr(error.message); setBusy(false); return; }
    const { data } = await supabase.rpc('session_attendance', { p_session_id: sid });
    setRoster(data || []);
    load();
    setBusy(false);
  }

  return (
    <AppShell role="admin" active="Activity" title="Training & Games">
      <div className="segmented" style={{ marginBottom: 16, maxWidth: 320 }}>
        <button aria-selected={tab === 'training'} onClick={() => setTab('training')}>Training logs</button>
        <button aria-selected={tab === 'matches'} onClick={() => setTab('matches')}>Games</button>
      </div>
      {err && <div className="card" style={{ marginBottom: 12, borderLeft: '4px solid var(--danger)', color: 'var(--danger)' }}>{err}</div>}

      {tab === 'training' ? (
        <div className="card">
          <div className="section-header"><h4 style={{ margin: 0 }}>All training sessions</h4><span className="badge badge-neutral">{log.length}</span></div>
          {log.length === 0 ? <p className="subtle">No training sessions logged yet.</p> : (
            <div className="stack" style={{ gap: 8 }}>
              {log.map((s) => (
                <div key={s.session_id} style={{ border: '1px solid var(--border)', borderRadius: 10 }}>
                  <div className="row between" style={{ padding: '10px 12px', cursor: 'pointer' }} onClick={() => toggleOpen(s.session_id)}>
                    <div>
                      <strong>{s.team_name}</strong>
                      <div className="subtle" style={{ fontSize: 12 }}>{fmt(s.when_at)}{s.notes ? ` · ${s.notes}` : ''}</div>
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="badge badge-success">{s.present}/{s.total} present</span>
                      <span className="subtle">{openId === s.session_id ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  {openId === s.session_id && (
                    <div style={{ padding: '0 12px 12px' }}>
                      {roster.length === 0 ? <p className="subtle" style={{ fontSize: 13 }}>No players.</p> : roster.map((r) => (
                        <div key={r.player_id} className="row between" style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                          <span>{r.name} <span className="subtle" style={{ fontSize: 12 }}>· {r.child_code}</span></span>
                          <div className="segmented" style={{ minWidth: 170 }}>
                            <button type="button" aria-selected={r.present} disabled={busy} onClick={() => setPresent(s.session_id, r.player_id, true)}>Present</button>
                            <button type="button" aria-selected={!r.present} disabled={busy} onClick={() => setPresent(s.session_id, r.player_id, false)}>Absent</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="card">
          <div className="section-header"><h4 style={{ margin: 0 }}>All games</h4><span className="badge badge-neutral">{matches.length}</span></div>
          {matches.length === 0 ? <p className="subtle">No games logged yet.</p> : (
            <table className="table"><thead><tr><th>Team</th><th>Opponent</th><th>Date</th><th>Venue</th><th>Formation</th><th>Result</th></tr></thead>
              <tbody>{matches.map((m) => (
                <tr key={m.match_id}>
                  <td>{m.team_name}</td><td>{m.opponent}</td><td>{fmt(m.when_at)}</td>
                  <td>{m.venue || '—'}</td><td>{m.formation || '—'}</td><td>{m.result || '—'}</td>
                </tr>))}</tbody>
            </table>
          )}
        </div>
      )}
    </AppShell>
  );
}
