import { useEffect, useId, useRef } from 'react';
export default function SessionDiscardDialog({ action, busy, error, onClose, onConfirm }) {
  const ref=useRef(null), title=useId();
  useEffect(()=>{if(action)ref.current?.showModal();else ref.current?.close();},[action]);
  const workout=action?.type==='workout';
  return <dialog className="session-discard-dialog" ref={ref} aria-labelledby={title} onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
    <h2 id={title}>{workout?'Cancel this workout?':`Remove ${action?.name || 'exercise'}?`}</h2>
    <p>{workout?'This session will not count toward your completed workouts, PRs or exercise defaults. You can restore it from Cancelled sessions in History.':'This exercise and its logged sets will be left out of this session’s totals and records. Your programme stays the same. You can restore the exercise before finishing.'}</p>
    {error && <p className="inline-error" role="alert">{error}</p>}
    <div className="launch-actions"><button className="btn btn-secondary" onClick={onClose} disabled={busy}>Keep {workout?'workout':'exercise'}</button><button className="btn btn-primary" onClick={onConfirm} disabled={busy}>{busy?'Saving…':workout?'Cancel workout':'Remove exercise'}</button></div>
  </dialog>;
}
