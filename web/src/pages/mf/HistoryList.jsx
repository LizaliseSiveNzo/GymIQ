/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TabShell from '../../shell/TabShell.jsx';
import { supabase } from '../../lib/supabaseClient.js';
import { useAuth } from '../../context/AuthContext.jsx';

const fmt = (d) => new Date(d).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
const clock = (s) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '—');

// Recent sessions list.
export function HistoryList() {
  const { profile } = useAuth();
  const navigate=useNavigate();
  const [cancelledView,setCancelledView]=useState(false);
  const [restoring,setRestoring]=useState(null);
  const [logs, setLogs] = useState(undefined);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!profile?.id || profile.demo) { setLogs([]); return; }
    let abandoned=false;
    setLogs(undefined); setError('');
    (async () => {
      let query = supabase.from('workout_logs')
        .select('id,day_id,created_at,completed_at,cancelled_at,excluded_exercises,duration_sec,note,programme_days(name),logged_sets(weight,reps,weight_left,reps_left,set_type,completed,programme_exercise_id,exercise_name)')
        .eq('client_id', profile.id)
        .order('created_at', { ascending: false }).limit(40);
      query=cancelledView?query.not('cancelled_at','is',null):query.not('completed_at','is',null).is('cancelled_at',null);
      const {data,error}=await query;
      if(abandoned)return;
      if (error) setError('Could not load your history. Please refresh and try again.');
      else setLogs(data || []);
    })();
  return ()=>{abandoned=true;};
  }, [profile?.id,cancelledView]); // eslint-disable-line react-hooks/exhaustive-deps

  async function restore(log) {
    setRestoring(log.id); setError('');
    try {
      const {error}=await supabase.rpc('cancel_workout',{p_log:log.id,p_restore:true});
      if(error)throw error;
      navigate(`/workout/session/${log.day_id || 'free'}`);
    } catch(error) {setError(error.message || 'Could not restore this workout.');}
    finally {setRestoring(null);}
  }

  return (
    <TabShell active="workout" title="History">
      <div className="launch-actions" style={{marginBottom:16}}><button className={`btn ${!cancelledView?'btn-primary':'btn-secondary'}`} aria-pressed={!cancelledView} onClick={()=>setCancelledView(false)}>Completed</button><button className={`btn ${cancelledView?'btn-primary':'btn-secondary'}`} aria-pressed={cancelledView} onClick={()=>setCancelledView(true)}>Cancelled sessions</button><Link to="/workout/stats" className="btn btn-ghost">Exercise stats ↗</Link></div>
      {error && <p className="inline-error" role="alert">{error}</p>}
      {(logs === undefined && !error) && <div className="mf-card"><div className="subtle">Loading…</div></div>}
      {logs?.length === 0 && (
        <div className="mf-card" style={{ borderStyle: 'dashed' }}>
          <h4>{cancelledView ? 'No cancelled sessions' : 'No sessions yet'}</h4>
          <div className="subtle" style={{ fontSize: 13 }}>{cancelledView ? 'Cancelled workouts can be restored here without affecting your records.' : 'Finish your first workout and it will appear here.'}</div>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(logs || []).map((l) => {
          const hard = (l.logged_sets || []).filter((s) => s.completed !== false && s.set_type !== 'warmup' && !(l.excluded_exercises || []).includes(s.programme_exercise_id ? `pe_${s.programme_exercise_id}` : `nm_${s.exercise_name}`));
          const vol = hard.reduce((a, s) =>
            a + ((Number(s.weight) || 0) * (Number(s.reps) || 0)) +
                ((Number(s.weight_left) || 0) * (Number(s.reps_left) || 0)), 0);
          if(cancelledView)return <div key={l.id} className="mf-card"><h3>{l.programme_days?.name || 'Freestyle workout'}</h3><p className="subtle">Cancelled {fmt(l.cancelled_at)} · Excluded from stats and defaults.</p><button className="btn btn-secondary" disabled={!!restoring} onClick={()=>restore(l)}>{restoring===l.id?'Restoring…':'Restore workout'}</button></div>;
          return (
            <Link key={l.id} className="mf-card" to={`/workout/history/${l.id}`}
              style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
              <span style={{
                width: 38, height: 38, borderRadius: 10, background: 'var(--surface-2)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
                flex: '0 0 auto',
              }}>🏋️</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 14 }}>{l.programme_days?.name || (l.note === 'freeform' ? 'Freestyle workout' : 'Session')}</b>
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
