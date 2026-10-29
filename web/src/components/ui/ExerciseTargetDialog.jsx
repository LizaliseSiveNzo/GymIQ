import { useEffect, useId, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { targetKey } from '../../lib/exerciseTargets.js';
import { validSetNumbers } from '../../lib/setNumbers.js';
export default function ExerciseTargetDialog({ exercise, target, onClose, onSaved }) {
  const {profile}=useAuth();
  const ref=useRef(null),title=useId();
  const [weight,setWeight]=useState(''),[reps,setReps]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{if(exercise){setWeight(target?.weight??exercise.weight??'');setReps(target?.reps??exercise.reps??'');setError('');ref.current?.showModal();}else ref.current?.close();},[exercise,target]);
  async function save(event){
    event.preventDefault(); if(busy)return;
    if(!validSetNumbers(weight,reps)){setError('Enter a weight from 0–9999.99 kg and 1–1000 whole reps.');return;}
    setBusy(true);setError('');
    try{
      const key=targetKey(exercise);
      const {data,error}=await supabase.from('exercise_targets').upsert({user_id:profile.id,exercise_key:key,exercise_id:exercise.exerciseId||null,exercise_name:exercise.name,weight:Number(weight),reps:Number(reps),updated_at:new Date().toISOString()},{onConflict:'user_id,exercise_key'}).select('*').single();
      if(error)throw error;
      onSaved(data,key);onClose();
    }catch(error){setError(error.message || 'Could not save your target.');}finally{setBusy(false);}
  }
  async function clear(){
    if(busy)return;setBusy(true);setError('');
    try{const key=targetKey(exercise);const {error}=await supabase.from('exercise_targets').delete().eq('user_id',profile.id).eq('exercise_key',key);if(error)throw error;onSaved(null,key);onClose();}
    catch(error){setError(error.message || 'Could not clear your target.');}finally{setBusy(false);}
  }
  return <dialog ref={ref} className="session-discard-dialog edit-set-dialog" aria-labelledby={title} onCancel={event=>{event.preventDefault();if(!busy)onClose();}}><form onSubmit={save}>
    <h2 id={title}>Set exercise target</h2><p>{exercise?.name}. This prefills unlogged sets until you change or clear it. It does not create a performed set or PR, or change a completed set.</p>
    <div className="set-edit-grid"><label>Target weight (kg)<input className="input" type="number" min="0" max="9999.99" step="0.01" inputMode="decimal" value={weight} onChange={e=>setWeight(e.target.value)} required/></label><label>Target reps<input className="input" type="number" min="1" max="1000" step="1" inputMode="numeric" value={reps} onChange={e=>setReps(e.target.value)} required/></label></div>
    {error&&<p className="inline-error" role="alert">{error}</p>}
    <div className="launch-actions"><button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy?'Saving…':'Save target'}</button></div>
    {target&&<button type="button" className="btn btn-ghost" disabled={busy} onClick={clear}>Clear target · use last session instead</button>}
  </form></dialog>;
}
