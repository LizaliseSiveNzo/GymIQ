/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TabShell from '../../shell/TabShell.jsx';
import { supabase } from '../../lib/supabaseClient.js';
import { useAuth } from '../../context/AuthContext.jsx';

// WORKOUT tab — week strip, active program card, expandable day list.
// "Start" rotates through the split by sessions completed this week.
export default function WorkoutTab() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const todayDow = (new Date().getDay() + 6) % 7; // Monday-first index

  const [program, setProgram] = useState(undefined); // undefined=loading, null=none
  const [days, setDays] = useState([]);
  const [exByDay, setExByDay] = useState({});
  const [weekCount, setWeekCount] = useState(0);
  const [completed, setCompleted] = useState(new Set());

  useEffect(() => {
    if (!profile?.id || profile.demo) { setProgram(null); return; }
    let cancelled = false;
    (async () => {
      const p = await supabase.from('workout_programmes')
        .select('id,name,color,icon,days_per_week,current_week,goal,split')
        .eq('client_id', profile.id).eq('is_active', true).limit(1);
      if (cancelled) return;
      if (!p.data?.[0]) { setProgram(null); return; }
      const prog = p.data[0];
      setProgram(prog);

      const d = await supabase.from('programme_days')
        .select('id,label,name').eq('programme_id', prog.id).order('sort_order');
      if (cancelled) return;
      setDays(d.data || []);
      const ids = (d.data || []).map((x) => x.id);
      if (!ids.length) return;
      const x = await supabase.from('programme_exercises')
        .select('id,day_id,name,target_sets,target_reps,target_rir')
        .in('day_id', ids).order('sort_order');
      if (cancelled) return;
      const map = {};
      (x.data || []).forEach((row) => { (map[row.day_id] ||= []).push(row); });
      setExByDay(map);
    })();
    return () => { cancelled = true; };
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sessions finished since Monday → which day is up next in the rotation.
  useEffect(() => {
    if (!profile?.id || profile.demo) return;
    (async () => {
      const now = new Date();
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
      const { data } = await supabase.from('workout_logs')
        .select('id,day_id')
        .eq('client_id', profile.id)
        .not('completed_at', 'is', null)
        .gte('completed_at', monday.toISOString());
      const rows = data || [];
      setWeekCount(rows.length);
      setCompleted(new Set(rows.map((r) => r.day_id).filter(Boolean)));
    })();
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <TabShell active="workout" title="Workout">
      <div className="daystrip">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className={`day-pill ${i === todayDow ? 'today' : ''}`}>
            <span>{d}</span>
            <span className="d">{17 + i}</span>
            <span className="day-dot" />
          </div>
        ))}
      </div>

      <div className="sec-label">Active program</div>

      {program === undefined && <div className="mf-card"><div className="subtle" style={{ fontSize: 13 }}>Loading…</div></div>}

      {program === null && (
        <div className="mf-card" style={{ borderStyle: 'dashed' }}>
          <h4>No active program yet</h4>
          <p className="subtle" style={{ margin: '4px 0 12px' }}>
            Run the onboarding generator — goal → focus muscles → days → split → your equipment.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a className="btn btn-primary" href="/onboarding">Open the builder</a>
            <a className="btn btn-secondary" href="/exercises">Browse exercise library</a>
          </div>
        </div>
      )}

      {program && (
        <>
          <div className="mf-card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              width: 44, height: 44, borderRadius: 12,
              background: `${program.color || '#C6FF3A'}22`,
              border: `1px solid ${program.color || '#C6FF3A'}`,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
              flex: '0 0 auto',
            }}>{program.icon || '💪'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h4 style={{ margin: 0 }}>{program.name}</h4>
              <div className="subtle" style={{ fontSize: 13 }}>
                {program.days_per_week ?? days.length} workouts · Week {program.current_week ?? 1}
                {program.goal ? ` · ${program.goal}` : ''}
              </div>
            </div>
            <button
              className="btn btn-primary"
              disabled={!days.length}
              onClick={() => {
                const next = days.length ? days[weekCount % days.length] : null;
                if (next) navigate(`/workout/day/${next.id}`);
              }}
            >
              Start{days.length ? ` ${days[weekCount % days.length]?.label || ''}` : ''}
            </button>
          </div>

          <div className="sec-label">Workouts</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {days.map((d) => {
              const list = exByDay[d.id] || [];
              const isDone = completed.has(d.id);
              return (
                <div key={d.id} role="button" tabIndex={0}
                  onClick={() => navigate(`/workout/day/${d.id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/workout/day/${d.id}`); }}
                  className="mf-card" style={{ padding: '13px 15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, opacity: isDone ? 0.5 : 1 }}
                >
                  <span style={{
                    width: 34, height: 34, borderRadius: 50, flex: '0 0 auto',
                    background: isDone ? 'var(--green-100)' : 'var(--surface-2)', color: isDone ? 'var(--green-600)' : 'var(--ink)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800,
                  }}>{isDone ? '✓' : (d.label || d.name[0])}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ fontSize: 14.5, textDecoration: isDone ? 'line-through' : 'none' }}>{d.name}</b>
                    <div className="subtle" style={{ fontSize: 12.5 }}>
                      {isDone ? 'Completed this week' : `${list.length} exercises${list[0] ? ` · ${list.slice(0, 2).map((x) => x.name).join(', ')}${list.length > 2 ? '…' : ''}` : ''}`}
                    </div>
                  </span>
                  <span style={{ color: 'var(--text-subtle)', fontSize: 18 }}>›</span>
                </div>
              );
            })}
          </div>

          <p className="subtle" style={{ fontSize: 12.5, marginTop: 14 }}>
            Sets log live with RIR, set types and rest timers — history keeps every session.
          </p>
        </>
      )}
    </TabShell>
  );
}
