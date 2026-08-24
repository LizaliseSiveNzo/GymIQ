/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import TabShell from '../../shell/TabShell.jsx';
import { supabase } from '../../lib/supabaseClient.js';
import { useAuth } from '../../context/AuthContext.jsx';

const fmtFull = (d) => new Date(d).toLocaleString([], {
  weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
});
const clock = (s) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '—');

// One finished session, read-only.
export function HistoryDetail() {
  const { logId } = useParams();
  const { profile } = useAuth();
  const [log, setLog] = useState(undefined);

  useEffect(() => {
    if (!profile?.id || !logId) return;
    (async () => {
      const l = await supabase.from('workout_logs')
        .select('id,created_at,completed_at,duration_sec,note,programme_days(label,name)')
        .eq('id', logId).eq('client_id', profile.id).single();
      const s = await supabase.from('logged_sets')
        .select('*').eq('log_id', logId).order('created_at');
      setLog({ ...l.data, sets: s.data || [] });
    })();
  }, [profile?.id, logId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (log === undefined) return <TabShell active="workout" title="Session"><div className="mf-card"><div className="subtle">Loading…</div></div></TabShell>;
  if (!log) return <TabShell active="workout" title="Session"><div className="mf-card"><h4>Not found</h4><Link to="/workout/history" className="btn btn-secondary" style={{ marginTop: 8 }}>Back to history</Link></div></TabShell>;

  const groups = [];
  for (const s of log.sets) {
    const g = groups.find((x) => x.name === s.exercise_name);
    if (g) g.rows.push(s); else groups.push({ name: s.exercise_name, rows: [s] });
  }
  const hard = log.sets.filter((s) => s.set_type !== 'warmup');
  const volume = hard.reduce((a, s) =>
    a + ((Number(s.weight) || 0) * (Number(s.reps) || 0)) +
        ((Number(s.weight_left) || 0) * (Number(s.reps_left) || 0)), 0);

  return (
    <TabShell active="workout" title={log.programme_days?.name || (log.note === 'freeform' ? 'Empty Workout' : 'Session')}>
      <div className="mf-card" style={{ marginBottom: 12 }}>
        <h4>{fmtFull(log.completed_at || log.created_at)}</h4>
        <div className="prev-row"><b>{hard.length}</b><span>hard sets</span></div>
        <div className="prev-row"><b>{Math.round(volume).toLocaleString()} kg</b><span>total volume</span></div>
        <div className="prev-row"><b>{clock(log.duration_sec)}</b><span>duration</span></div>
      </div>

      {groups.map((g) => (
        <div key={g.name} className="mf-card" style={{ marginBottom: 10 }}>
          <h4 style={{ fontSize: 14 }}>{g.name}</h4>
          {g.rows.map((s) => (
            <div key={s.id} className="prev-row">
              <b>#{s.set_number}{s.set_type !== 'normal' ? ` ${s.set_type}` : ''}</b>
              <span>
                {s.weight ?? '—'} kg × {s.reps ?? '—'}
                {s.reps_left != null ? ` · L ${s.weight_left ?? '—'}×${s.reps_left}` : ''}
                {s.rir != null ? ` @ RIR ${s.rir}` : ''}
              </span>
            </div>
          ))}
        </div>
      ))}

      <Link className="btn btn-secondary btn-block" to="/workout/history" style={{ marginTop: 4 }}>All sessions</Link>
    </TabShell>
  );
}
