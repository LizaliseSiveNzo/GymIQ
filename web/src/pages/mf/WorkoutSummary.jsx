/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import TabShell from '../../shell/TabShell.jsx';
import { supabase } from '../../lib/supabaseClient.js';
import { useAuth } from '../../context/AuthContext.jsx';
import ExerciseIllustration from '../../components/ui/ExerciseIllustration.jsx';
import {loadWorkoutWeek,weekStart,exerciseIdentity} from '../../lib/workoutWeek.js';
import './workoutWeek.css';

export const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 3).toUpperCase() || '?';

// Summary of a program day before you start: exercise list with target sets ×
// rep-range @ RIR and muscle chips, then "Start Workout".
export default function WorkoutSummary() {
  const { dayId } = useParams();
  const [search]=useSearchParams();
  const selectedWeek=search.get('week')||weekStart();
  const past=selectedWeek<weekStart();
  const [weekData,setWeekData]=useState(null);
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [day, setDay] = useState(undefined);
  const [rows, setRows] = useState([]);
  const [mName, setMName] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    (async () => {
      const [dayResult, exerciseResult, muscleResult] = await Promise.all([
        supabase.from('programme_days').select('id,label,name,programme_id').eq('id', dayId).maybeSingle(),
        supabase.from('programme_exercises')
          .select('id,name,target_sets,target_reps,target_rir,sort_order,exercise_id,exercises(primary_muscle_id,secondary_muscle_fraction)')
          .eq('day_id', dayId).order('sort_order'),
        supabase.from('muscles').select('id,name'),
      ]);
      if (cancelled) return;
      if (dayResult.error || exerciseResult.error || muscleResult.error) { setError('Could not load this workout. Please return to your programme and try again.'); setDay(null); return; }
      const d = dayResult.data, pes = exerciseResult.data, mus = muscleResult.data;
      let loaded;
      try{loaded=d?await loadWorkoutWeek({programmeId:d.programme_id,week:selectedWeek}):null;}catch(e){if(!cancelled){setError(e.message);setDay(null);}return;}
      if(cancelled)return;
      setWeekData(loaded);setDay(d||null);
      setRows([...(pes||[]),...(loaded?.extras||[]).filter(e=>e.day_id===dayId)]);
      setMName(Object.fromEntries((mus || []).map((m) => [m.id, m.name])));
    })();
    return () => { cancelled = true; };
  }, [dayId, profile?.id, selectedWeek]);

  const estMin = useMemo(() => {
    const sets = rows.reduce((a, r) => a + (r.target_sets || 0), 0);
    return Math.max(10, Math.round(sets * 3.5 + 5));
  }, [rows]);

  if (day === undefined) return <TabShell active="workout" title="Workout"><div className="mf-card"><div className="subtle">Loading…</div></div></TabShell>;
  if (day === null) return <TabShell active="workout" title="Workout"><div className="mf-card"><h4>{error || 'Workout not found'}</h4><a className="btn btn-secondary" href="/workout">Back to Workout</a></div></TabShell>;

  return (
    <TabShell active="workout" title={day.name || `Workout ${day.label || ''}`}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <h3 style={{ margin: 0 }}>{rows.length} exercises</h3>
        <button className="btn btn-ghost" style={{ minHeight: 30 }} onClick={() => navigate(past?`/workout?week=${selectedWeek}`:'/workout')}>← Back</button>
      </div>
      <div className="subtle" style={{ fontSize: 13, marginBottom: 14 }}>{past?`Week of ${selectedWeek} · completed and missed exercises`:`Estimated time · ${estMin} min`}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 90 }}>
        {rows.length === 0 && <div className="mf-card"><h4>Rest day</h4><div className="subtle">No exercises on this day.</div></div>}
        {rows.map((r) => {
          const replacement=(weekData?.sessions||[]).flatMap(session=>session.sets||[]).find(set=>set.programme_exercise_id===r.id&&set.exercise_id!==r.exercise_id&&set.name!==r.name);
          const performed=weekData?.sessions?.some(session=>(session.sets||[]).some(set=>set.programme_exercise_id===r.id||exerciseIdentity(set)===exerciseIdentity(r)));
          const missed=past&&weekData?.full_week&&!performed;
          const secs = Object.keys(r.exercises?.secondary_muscle_fraction || {});
          const chips = [r.exercises?.primary_muscle_id, ...secs].filter(Boolean).map((id) => mName[id] || id).slice(0, 4);
          const [lo, hi] = String(r.target_reps || '8-12').split('-');
          return (
            <div key={r.id} className={`mf-card week-exercise ${performed?'is-complete':missed?'is-missed':''}`} style={{ display: 'flex', gap: 12 }}>
              <ExerciseIllustration exerciseId={r.exercise_id} name={r.name} />
              <div className="week-exercise-copy" style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 15 }}>{r.name}</b><span className="subtle">{replacement?`✓ Replaced with ${replacement.name}`:performed?'✓ Performed this week':missed?'Missed this week':'Planned'}</span>{r.optional&&<span className="week-extra-label">Optional make-up · {r.target_sets} sets · from week of {r.source_week}</span>}
                <div className="subtle" style={{ fontSize: 12.5, marginTop: 2 }}>
                  {r.target_sets || 3} × {hi ? `${lo}–${hi}` : lo} reps{r.target_rir != null ? ` @ RIR ${r.target_rir}` : ''}
                </div>
                {chips.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {chips.map((c) => <span key={c} className="badge badge-neutral" style={{ fontSize: 11 }}>{c}</span>)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* sticky start */}
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 'calc(var(--tabbar-h) + env(safe-area-inset-bottom) + 8px)', padding: '0 16px', zIndex: 40 }}>
        <button className="btn btn-primary btn-lg btn-block" disabled={rows.length === 0||past||!weekData?.can_write}
          onClick={() => navigate(`/workout/session/${dayId}`)}>
          {past?'Past week · view only':'Start workout'}
        </button>
      </div>
    </TabShell>
  );
}
