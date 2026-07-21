/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

// Per-player training attendance history (Training tab).
export default function PlayerTrainingLog({ playerId, teamId }) {
  const [rows, setRows] = useState(null);

  useEffect(() => { (async () => {
    if (!teamId) { setRows([]); return; }
    const { data: sessions } = await supabase.from('training_sessions')
      .select('id,notes,starts_at,date,location').eq('team_id', teamId)
      .order('starts_at', { ascending: false, nullsFirst: false }).limit(30);
    const ids = (sessions || []).map((s) => s.id);
    let att = [];
    if (ids.length) {
      const { data } = await supabase.from('attendance')
        .select('session_id,attended,left_early,left_reason').eq('player_id', playerId).in('session_id', ids);
      att = data || [];
    }
    let stand = [];
    if (ids.length) {
      const { data } = await supabase.from('training_standouts')
        .select('session_id').eq('player_id', playerId).in('session_id', ids);
      stand = (data || []).map((x) => x.session_id);
    }
    setRows((sessions || []).map((s) => ({ ...s, rec: att.find((a) => a.session_id === s.id) || null, standout: stand.includes(s.id) })));
  })(); }, [playerId, teamId]);

  if (rows === null) return <div className="card" style={{ marginTop: 16 }}>Loading training…</div>;

  const logged = rows.filter((r) => r.rec);
  const present = logged.filter((r) => r.rec.attended).length;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="section-header">
        <h4 style={{ margin: 0 }}>🏃 Training history</h4>
        <span className="badge badge-neutral">{logged.length ? `${present}/${logged.length} present` : 'No records'}</span>
      </div>
      {rows.length === 0 ? <p className="subtle" style={{ margin: 0 }}>No training sessions for this team yet.</p> : (
        <div className="stack" style={{ gap: 6 }}>
          {rows.map((r) => {
            const rec = r.rec;
            const when = r.starts_at ? new Date(r.starts_at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                     : (r.date ? new Date(r.date).toLocaleDateString() : 'Session');
            return (
              <div key={r.id} className="row between" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', flexWrap: 'wrap', gap: 6 }}>
                <div>
                  <strong style={{ fontSize: 13 }}>{r.notes || 'Training'}</strong>
                  <div className="subtle" style={{ fontSize: 12 }}>{when}{r.location ? ` · ${r.location}` : ''}</div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  {r.standout && <span className="badge badge-success" title="Stood out in this session">⭐ Standout</span>}
                  {rec?.left_early && <span className="badge badge-warning" title={rec.left_reason || ''}>Left early</span>}
                  {!rec ? <span className="badge badge-neutral">Not logged</span>
                    : <span className={`badge ${rec.attended ? 'badge-success' : 'badge-danger'}`}>{rec.attended ? 'Present' : 'Absent'}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
