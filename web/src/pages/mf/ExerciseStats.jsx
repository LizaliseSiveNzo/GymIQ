import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import TabShell from '../../shell/TabShell.jsx';
import ExerciseProgressList from '../../components/ui/ExerciseProgressList.jsx';
import ExercisePicker from '../../components/ui/ExercisePicker.jsx';
import SetEditDialog from '../../components/ui/SetEditDialog.jsx';
import ExerciseTargetDialog from '../../components/ui/ExerciseTargetDialog.jsx';
import { loadExerciseProgress } from '../../lib/loadExerciseProgress.js';
import { buildExerciseProgress } from '../../lib/exerciseProgress.js';
import { loadExerciseTargets, targetKey } from '../../lib/exerciseTargets.js';
import { useAuth } from '../../context/AuthContext.jsx';
export default function ExerciseStats() {
  const { profile } = useAuth();
  const [progress,setProgress] = useState(null), [targets,setTargets]=useState([]), [error,setError] = useState(''), [retry,setRetry] = useState(0);
  const [editing,setEditing]=useState(null),[targetExercise,setTargetExercise]=useState(null),[picker,setPicker]=useState(false);
  useEffect(()=>{
    if(!profile?.id) return;
    let cancelled=false;
    setError(''); setProgress(null);
    Promise.all([loadExerciseProgress(()=>cancelled),loadExerciseTargets()]).then(([history,targets])=>{if(!cancelled){setProgress(history);setTargets(targets);}}).catch(()=>{if(!cancelled)setError('Could not load your exercise stats and targets. Please try again.');});
    return ()=>{cancelled=true;};
  },[profile?.id,retry]);
  function corrected(row){setProgress(items=>buildExerciseProgress(items.flatMap(p=>p.sets).map(s=>s.id===row.id?row:s)));}
  function savedTarget(target,key){setTargets(items=>[...items.filter(t=>t.exercise_key!==key),...(target?[target]:[])].sort((a,b)=>a.exercise_name.localeCompare(b.exercise_name)));}
  return <TabShell title="Your progress."><div className="training-intro"><p>Your weights. Your reps. Your personal records.</p><Link to="/workout">← Workouts</Link></div>
    {error && <div className="inline-error" role="alert">{error} <button className="btn btn-ghost" onClick={()=>setRetry(n=>n+1)}>Try again</button></div>}
    {!progress && !error && <p role="status">Loading exercise records…</p>}
    {progress&&<>
      <section className="mf-card exercise-targets"><h2>Next-session targets</h2><p className="subtle">Plan weight and reps before an exercise, even if you haven’t logged it before. Targets prefill unlogged sets until cleared. They never count as records.</p>
        <button className="btn btn-secondary" onClick={()=>setPicker(open=>!open)}>{picker?'Close exercise picker':'+ Set exercise target'}</button>
        {picker&&<ExercisePicker mode="pick" pickLabel="Set target" onPick={exercise=>{setTargetExercise({exerciseId:exercise.id,name:exercise.name});setPicker(false);}}/>}
        {targets.map(target=><div className="prev-row target-list-row" key={target.exercise_key}><div><strong>{target.exercise_name}</strong><span>Planned · {Number(target.weight)} kg × {target.reps}</span></div><button className="btn btn-ghost" aria-label={`Edit target for ${target.exercise_name}`} onClick={()=>setTargetExercise({exerciseId:target.exercise_id,name:target.exercise_name})}>Edit target</button></div>)}
      </section>
      <p className="subtle" style={{fontSize:12}}>Logged something incorrectly? Open its weight & rep history and edit the set. Records and totals will be recalculated.</p>
      <ExerciseProgressList progress={progress} onEdit={setEditing} onPreset={setTargetExercise}/>
    </>}
    <SetEditDialog row={editing} onClose={()=>setEditing(null)} onSaved={corrected}/>
    <ExerciseTargetDialog exercise={targetExercise} target={targetExercise?targets.find(t=>t.exercise_key===targetKey(targetExercise)):null} onClose={()=>setTargetExercise(null)} onSaved={savedTarget}/>
  </TabShell>;
}
