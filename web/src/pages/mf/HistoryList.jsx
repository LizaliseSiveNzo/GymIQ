/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import TabShell from '../../shell/TabShell.jsx';
import { supabase } from '../../lib/supabaseClient.js';
import { useAuth } from '../../context/AuthContext.jsx';

const fmt = (d) => new Date(d).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
const clock = (s) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '—');

// Recent sessions list.
export function HistoryList() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState(undefined);

  useEffect(() => {
    if (!profile?.id || profile.demo) { setLogs([]); return; }
    (async () => {
      const { data } = await supabase.from('workout_logs')
        .select('id,created_at,duration_sec,note,programme_days(name),logged_sets(weight,reps,weight_left,reps_left,set_type)')
        .eq('client_id', profile.id)
        .order('created_at', { ascending: false }).limit(40);
      setLogs(data || []);
    })();
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <TabShell active="workout" title="History">
      {(logs === undefined) && <div className="mf-card"><div className="subtle">Loading…</div></div>}
      {logs?.length === 0 && (
        <div className="mf-card" style={{ borderStyle: 'dashed' }}>
          <h4>No sessions yet</h4>
          <div className="subtle" style={{ fontSize: 13 }}>Finish your first workout and it will appear here.</div>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(logs || []).map((l) => {
          const hard = (l.logged_sets || []).filter((s) => s.set_type !== 'warmup');
          const vol = hard.reduce((a, s) =>
            a + ((Number(s.weight) || 0) * (Number(s.reps) || 0)) +
                ((Number(s.weight_left) || 0) * (Number(s.reps_left) || 0)), 0);
          return (
            <Link key={l.id} className="mf-card" to={`/workout/history/${l.id}`}
              style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
              <span style={{
                width: 38, height: 38, borderRadius: 10, background: 'var(--surface-2)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
                flex: '0 0 auto',
              }}>🏋️</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 14 }}>{l.programme_days?.name || (l.note === 'freeform' ? 'Empty workout' : 'Session')}</b>
                <div className="subtle" style={{ fontSize: 12.5 }}>
                  {fmt(l.created_at)} · {hard.length} sets · {Math.round(vol).toLocaleString()} kg · {clock(l.duration_sec)}
                </div>
              </span>
              <span style={{ color: 'var(--text-subtle)', fontSize: 18 }}>›</span>
            </Link>
          );
        })}
      </div>
    </TabShell>
  );
}
