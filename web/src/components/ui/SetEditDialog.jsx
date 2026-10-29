import { useEffect, useId, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient.js';
import { validSetNumbers } from '../../lib/setNumbers.js';
export default function SetEditDialog({ row, onClose, onSaved }) {
  const dialog=useRef(null), title=useId();
  const [draft,setDraft]=useState({}),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    if(row){setDraft({weight:row.weight??0,reps:row.reps??'',leftWeight:row.weight_left??0,leftReps:row.reps_left??'',rir:row.rir??''});setError('');dialog.current?.showModal();}
    else dialog.current?.close();
  },[row]);
  const hasLeft=row?.reps_left!=null;
  const change=(field,value)=>setDraft(d=>({...d,[field]:value}));
  async function save(event){
    event.preventDefault(); if(busy)return;
    if(!validSetNumbers(draft.weight,draft.reps) || (hasLeft&&!validSetNumbers(draft.leftWeight,draft.leftReps)) || (draft.rir!==''&&(!Number.isInteger(Number(draft.rir))||Number(draft.rir)<0||Number(draft.rir)>10))){setError('Enter a weight from 0–9999.99 kg, 1–1000 whole reps, and an optional RIR from 0–10.');return;}
    setBusy(true);setError('');
    try{
      const expected=Object.fromEntries(['weight','reps','weight_left','reps_left','rir'].map(key=>[key,row[key]??null]));
      const {data,error}=await supabase.rpc('edit_workout_set',{p_set:row.id,p_weight:Number(draft.weight),p_reps:Number(draft.reps),p_weight_left:hasLeft?Number(draft.leftWeight):null,p_reps_left:hasLeft?Number(draft.leftReps):null,p_rir:draft.rir===''?null:Number(draft.rir),p_expected:expected});
      if(error)throw error;
      if(!data?.id)throw new Error('Your set could not be updated. Please reload and try again.');
      onSaved(data);onClose();
    }catch(error){setError(error.message || 'Could not save your correction. Please try again.');}
    finally{setBusy(false);}
  }
  return <dialog ref={dialog} className="session-discard-dialog edit-set-dialog" aria-labelledby={title} onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
    <form onSubmit={save}><h2 id={title}>Edit logged set</h2><p>{row?.exercise_name} · Set {row?.set_number}. Saving updates session totals and recalculates records.</p>
      <div className="set-edit-grid"><label>{hasLeft?'Right weight (kg)':'Weight (kg)'}<input className="input" type="number" min="0" max="9999.99" step="0.01" inputMode="decimal" value={draft.weight??''} onChange={e=>change('weight',e.target.value)} required/></label>
      <label>{hasLeft?'Right reps':'Reps'}<input className="input" type="number" min="1" max="1000" step="1" inputMode="numeric" value={draft.reps??''} onChange={e=>change('reps',e.target.value)} required/></label>
      {hasLeft&&<><label>Left weight (kg)<input className="input" type="number" min="0" max="9999.99" step="0.01" value={draft.leftWeight??''} onChange={e=>change('leftWeight',e.target.value)} required/></label><label>Left reps<input className="input" type="number" min="1" max="1000" step="1" value={draft.leftReps??''} onChange={e=>change('leftReps',e.target.value)} required/></label></>}
      <label>RIR (optional)<input className="input" type="number" min="0" max="10" step="1" value={draft.rir??''} onChange={e=>change('rir',e.target.value)}/></label></div>
      {error&&<p className="inline-error" role="alert">{error}</p>}
      <div className="launch-actions"><button className="btn btn-secondary" type="button" disabled={busy} onClick={onClose}>Keep original</button><button className="btn btn-primary" disabled={busy}>{busy?'Saving…':'Save correction'}</button></div>
    </form>
  </dialog>;
}
