import {useEffect,useState} from 'react';
import {supabase} from '../../lib/supabaseClient.js';
import {coachKey,progressionSuggestion} from '../../lib/progressionCoach.js';
import './progressionCoach.css';
export default function ProgressionCoach({item,progress,feedback,preferences,readiness,defaultIncrement,userId,logId,hasLogged,onFeedback,onPreference,onApply,unavailable,locked=false}){
 const key=coachKey(item),pref=preferences.find(p=>p.exercise_key===key);
 const [increment,setIncrement]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[applied,setApplied]=useState(false);
 useEffect(()=>{setIncrement(pref?.load_increment??defaultIncrement??'');setError('');setApplied(false);},[key,pref?.load_increment,defaultIncrement]);
 const suggestion=progressionSuggestion({item,progress,feedback,readiness,increment:pref?.load_increment??defaultIncrement});
 useEffect(()=>setApplied(false),[suggestion.signature]);
 const current=feedback.find(f=>f.log_id===logId&&f.exercise_key===key);
 async function saveEffort(effort){if(busy)return;setBusy(true);setError('');try{
  const row={user_id:userId,log_id:logId,exercise_key:key,exercise_id:item.exerciseId||null,exercise_name:item.name,effort,updated_at:new Date().toISOString()};
  const {data,error}=await supabase.from('exercise_coach_feedback').upsert(row,{onConflict:'user_id,log_id,exercise_key'}).select().single();
  if(error)throw error;onFeedback(data);
 }catch{setError('Could not save effort feedback. Your workout sets are unchanged.');}finally{setBusy(false);}}
 async function saveIncrement(){if(busy)return;const value=Number(increment);if(!Number.isFinite(value)||value<.1||value>100){setError('Enter an available increase between 0.1 and 100 kg.');return;}setBusy(true);setError('');try{
  const {data,error}=await supabase.from('exercise_coach_preferences').upsert({user_id:userId,exercise_key:key,load_increment:value},{onConflict:'user_id,exercise_key'}).select().single();
  if(error)throw error;onPreference(data);
 }catch{setError('Could not save your equipment increment. Please try again.');}finally{setBusy(false);}}
 return <section className="progression-coach" aria-label="Progression coach">
  <div className="row between"><strong>Progression coach</strong><span className="badge badge-neutral">Rules-based · review first</span></div>
  {unavailable?<p className="subtle">Your full history or coach feedback could not load. Continue with your previous defaults or manual values; progression suggestions are unavailable.</p>:<>
   <h3>{suggestion.title}</h3><p className="subtle">{suggestion.reason}</p>
   {suggestion.canApply&&<div className="coach-prescription"><strong>{suggestion.weight>0?`${suggestion.weight} kg`:'Bodyweight'} × {new Set(suggestion.rowReps).size>1?suggestion.rowReps.join(' / '):suggestion.reps} reps</strong><span>per prescribed set · {item.laterality?.startsWith('unilateral')?'kg and reps per side':'kg as entered in your log'}</span></div>}
   {suggestion.canApply&&<button type="button" className="btn btn-primary" disabled={busy||locked||hasLogged} onClick={()=>{onApply(suggestion);setApplied(true);}}>{applied?'Reapply suggestion':'Use for this session'}</button>}
   <p className="subtle coach-small">{hasLogged?'An exercise has already started. Suggestions cannot overwrite its logged sets.':'Accepting fills this session’s inputs only. Your saved manual target stays unchanged, and nothing counts as performed until you log a set.'}</p>
  </>}
  <details><summary>Available weight increment</summary><p className="subtle coach-small">The smallest increase in the kg value you log: total barbell increase, or per dumbbell / per side where indicated. Use the increments available at your gym.</p><div className="coach-increment"><label>Increase · kg<input type="number" min="0.1" max="100" step="0.1" value={increment} onChange={e=>setIncrement(e.target.value)}/></label><button type="button" className="btn btn-secondary" disabled={busy||unavailable} onClick={saveIncrement}>Save increment</button></div></details>
  <div className="coach-feedback"><strong>How did this exercise feel today?</strong><div className="launch-actions">{[['easy','Too easy'],['right','About right'],['hard','Too hard']].map(([value,label])=><button type="button" key={value} className={`btn ${current?.effort===value?'btn-primary':'btn-ghost'}`} aria-pressed={current?.effort===value} disabled={busy||!hasLogged||unavailable} onClick={()=>saveEffort(value)}>{label}</button>)}</div><p className="subtle coach-small">{hasLogged?'Saved feedback informs a later session after this workout is finished.':'Log a working set first, then rate the effort. You can update the rating after your remaining sets.'}</p></div>
  {error&&<p className="inline-error" role="alert">{error}</p>}
 </section>;
}
