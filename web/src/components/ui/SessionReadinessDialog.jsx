import {useEffect,useId,useRef} from 'react';

export default function SessionReadinessDialog({open,readiness,busy,error,onChoose,onDismiss}){
 const ref=useRef(null),title=useId();
 useEffect(()=>{if(open&&!ref.current.open)ref.current.showModal();else if(!open&&ref.current.open)ref.current.close();},[open]);
 return <dialog ref={ref} className="session-discard-dialog session-readiness-dialog" aria-labelledby={title} onCancel={event=>{event.preventDefault();if(!busy)onDismiss();}}>
  <h2 id={title}>How are you feeling today?</h2>
  <div className="launch-actions">{[['ready','Ready'],['tired','Tired'],['sore','Sore']].map(([value,label])=><button type="button" key={value} className={`btn ${readiness===value?'btn-primary':'btn-secondary'}`} disabled={busy} onClick={()=>onChoose(value)}>{label}</button>)}</div>
  <p className="subtle">Your check-in helps adjust progression for this workout.</p>
  {error&&<p className="inline-error" role="alert">{error}</p>}
  <button type="button" className="btn btn-ghost" disabled={busy} onClick={onDismiss}>Not now</button>
 </dialog>;
}
