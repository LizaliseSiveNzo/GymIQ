import {useEffect,useId,useRef} from 'react';
import {Link} from 'react-router-dom';

export default function TrainingMenu(){
 const details=useRef(null),menuId=useId();
 useEffect(()=>{
  function outside(event){if(details.current&&!details.current.contains(event.target))details.current.open=false;}
  function escape(event){if(event.key==='Escape'&&details.current?.open){event.preventDefault();details.current.open=false;details.current.querySelector('summary')?.focus();}}
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
 },[]);
 const close=()=>{if(details.current)details.current.open=false;};
 return <details ref={details} className="training-tools" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))event.currentTarget.open=false;}}>
  <summary aria-label="Training menu" aria-controls={menuId}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg><span>Menu</span></summary>
  <nav id={menuId} className="training-tools-panel" aria-label="Training shortcuts">
   <span className="training-tools-group">Start & explore</span>
   <Link to="/workout/session/free" onClick={close}><span>Freestyle workout</span><span aria-hidden="true">＋</span></Link>
   <Link to="/exercises" onClick={close}><span>Exercise library</span><span aria-hidden="true">↗</span></Link>
   <span className="training-tools-group training-tools-divider">Your progress</span>
   <Link to="/workout/stats" onClick={close}><span>Exercise stats</span><span aria-hidden="true">↗</span></Link>
   <Link to="/workout/history" onClick={close}><span>History</span><span aria-hidden="true">↗</span></Link>
   <Link to="/workout/progress-story" onClick={close}><span>Monthly progress</span><span aria-hidden="true">↗</span></Link>
  </nav>
 </details>;
}
