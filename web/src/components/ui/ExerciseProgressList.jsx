import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ExerciseIllustration from './ExerciseIllustration.jsx';
import { setDescription } from '../../lib/exerciseProgress.js';
const date = value => new Date(value).toLocaleDateString('en-ZA',{day:'numeric',month:'short',year:'numeric'});
const best = value => `${value.weight > 0 ? `${value.weight} kg` : 'Bodyweight'} × ${value.reps}${value.side ? ` · ${value.side}` : ''}`;
export default function ExerciseProgressList({ progress, onEdit, onPreset }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => progress.filter(p => p.name.toLowerCase().includes(query.trim().toLowerCase())),[progress,query]);
  return <div className="stack">
    <label className="progress-search">Find an exercise<input className="input" type="search" placeholder="Search your exercises…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <p className="subtle" style={{fontSize:12}}>{progress.length} exercises tracked. Only working sets from finished workouts count. Estimated 1RM is a calculation, not a tested maximum.</p>
    {!filtered.length && <div className="mf-card">{progress.length ? 'No exercises match your search.' : 'Finish a workout to start building your exercise records.'}</div>}
    {filtered.map(p=><article className="mf-card exercise-progress-card" key={p.key}>
      <div className="exercise-catalog-row"><ExerciseIllustration exerciseId={p.exerciseId} name={p.name}/><div className="exercise-catalog-row__info"><h2>{p.name}</h2><p className="subtle">{p.sessions.length} sessions · {p.sets.length} working sets</p></div></div>
      <div className="exercise-progress-grid">
        <div><span>Heaviest set</span><strong>{best(p.bestWeight)}</strong><small>{date(p.bestWeight.row.completed_at)}</small></div>
        <div><span>Most reps</span><strong>{best(p.bestReps)}</strong><small>{date(p.bestReps.row.completed_at)}</small></div>
        <div><span>Estimated 1RM</span><strong>{p.estimatedMax > 0 ? `${Math.round(p.estimatedMax*10)/10} kg` : '—'}</strong></div>
        <div><span>Last session</span><strong>{setDescription(p.lastBest)}</strong><small>{date(p.last.date)}</small></div>
      </div>
      {onPreset&&<button className="btn btn-ghost" onClick={()=>onPreset({exerciseId:p.exerciseId,name:p.name,weight:p.lastBest.weight??0,reps:p.lastBest.reps})}>Set next-session target</button>}
      <details className="exercise-progress-history"><summary>View weight & rep history</summary>
        {p.sessions.map(session=><section key={session.id}><Link to={`/workout/history/${session.id}`}>{date(session.date)} ↗</Link>{session.sets.map((s,i)=><div className="prev-row progress-edit-row" key={s.id}><span>Set {i+1}</span><strong>{setDescription(s)}</strong>{onEdit&&<button className="btn btn-ghost" aria-label={`Edit ${p.name} set ${i+1} from ${date(session.date)}`} onClick={()=>onEdit(s)}>Edit</button>}</div>)}</section>)}
      </details>
    </article>)}
  </div>;
}
