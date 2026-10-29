/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import TabShell from '../../shell/TabShell.jsx';
import { supabase } from '../../lib/supabaseClient.js';
import { useAuth } from '../../context/AuthContext.jsx';
import SetEditDialog from '../../components/ui/SetEditDialog.jsx';

const fmtFull = (d) => new Date(d).toLocaleString([], {
  weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
});
const clock = (s) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '—');

// Saved sessions: corrections update the actual set and derived totals.
export function HistoryDetail() {
  const { logId } = useParams();
  const { profile } = useAuth();
  const [log, setLog] = useState(undefined);
  const [error, setError] = useState('');
  const [editing,setEditing]=useState(null);

  useEffect(() => {
    if (!profile?.id || !logId) return;
    (async () => {
      const l = await supabase.from('workout_logs')
        .select('id,created_at,completed_at,cancelled_at,excluded_exercises,duration_sec,note,programme_days(label,name)')
        .eq('id', logId).eq('client_id', profile.id).single();
      const s = await supabase.from('logged_sets')
        .select('*').eq('log_id', logId).order('created_at');
      if (l.error || s.error) { setError('This session could not be loaded. Return to history and try again.'); setLog(null); return; }
      setLog({ ...l.data, sets: (s.data || []).filter(row=>!(l.data.excluded_exercises || []).includes(row.programme_exercise_id ? `pe_${row.programme_exercise_id}` : `nm_${row.exercise_name}`)) });
    })();
  }, [profile?.id, logId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (log === undefined) return <TabShell active="workout" title="Session"><div className="mf-card"><div className="subtle">Loading…</div></div></TabShell>;
  if (!log) return <TabShell active="workout" title="Session"><div className="mf-card"><h4>{error || 'Session not found'}</h4><Link to="/workout/history" className="btn btn-secondary" style={{ marginTop: 8 }}>Back to history</Link></div></TabShell>;

  const groups = [];
  for (const s of log.sets) {
    const g = groups.find((x) => x.name === s.exercise_name);
    if (g) g.rows.push(s); else groups.push({ name: s.exercise_name, rows: [s] });
  }
  const hard = log.sets.filter((s) => s.completed !== false && s.set_type !== 'warmup');
  const volume = hard.reduce((a, s) =>
    a + ((Number(s.weight) || 0) * (Number(s.reps) || 0)) +
        ((Number(s.weight_left) || 0) * (Number(s.reps_left) || 0)), 0);

  return (
    <TabShell active="workout" title={log.programme_days?.name || (log.note === 'freeform' ? 'Freestyle workout' : 'Session')}>
      {log.cancelled_at && <p className="inline-error" role="status">This workout was cancelled. Its retained sets do not count toward your stats or defaults.</p>}
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
            <div key={s.id} className="prev-row progress-edit-row">
              <b>#{s.set_number}{s.set_type !== 'normal' ? ` ${s.set_type}` : ''}</b>
              <span>
                {s.weight ?? '—'} kg × {s.reps ?? '—'}
                {s.reps_left != null ? ` · L ${s.weight_left ?? '—'}×${s.reps_left}` : ''}
                {s.rir != null ? ` @ RIR ${s.rir}` : ''}
              </span>
              {!log.cancelled_at&&<button className="btn btn-ghost" aria-label={`Edit ${s.exercise_name} set ${s.set_number}`} onClick={()=>setEditing(s)}>Edit</button>}
            </div>
          ))}
        </div>
      ))}

      <SetEditDialog row={editing} onClose={()=>setEditing(null)} onSaved={row=>setLog(log=>({...log,sets:log.sets.map(s=>s.id===row.id?row:s)}))}/>
      <Link className="btn btn-secondary btn-block" to="/workout/history" style={{ marginTop: 4 }}>All sessions</Link>
    </TabShell>
  );
}
