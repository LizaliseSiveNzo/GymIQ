import {useEffect,useId,useRef,useState} from 'react';
import {useLocation,useNavigate} from 'react-router-dom';
import {useAuth} from '../../context/AuthContext.jsx';
import {useLogSync} from '../../context/LogSyncContext.jsx';
import {supabase} from '../../lib/supabaseClient.js';
import {savedWorkoutRecovery,rememberWorkout,forgetWorkout,recoveryPath,recoveryFromLog} from '../../lib/workoutRecovery.js';
import './workoutRecovery.css';

export default function WorkoutRecoveryPrompt(){
 const {session,profile}=useAuth(),{online}=useLogSync();
 const location=useLocation(),navigate=useNavigate(),ref=useRef(null),title=useId();
 const [candidate,setCandidate]=useState(null),[dismissed,setDismissed]=useState(false);
 const userId=profile?.id,eligible=!!userId&&session?.user?.id===userId&&!!profile.onboarded_at;
 const inSession=location.pathname.startsWith('/workout/session/');
 const home=['/workout','/bank','/more'].includes(location.pathname);
 useEffect(()=>{setDismissed(false);setCandidate(null);},[userId]);
 useEffect(()=>{if(inSession)setDismissed(true);},[inSession]);
 useEffect(()=>{
  if(!eligible||dismissed||inSession||!home)return;
  let active=true;
  const saved=savedWorkoutRecovery(userId);setCandidate(saved);
  if(!online)return;
  (async()=>{
   // Validate the local pointer first. A closed/finished workout must not reopen.
   if(saved){
    const result=await supabase.from('workout_logs').select('id,client_id,day_id,created_at,completed_at,cancelled_at').eq('client_id',userId).eq('id',saved.logId).maybeSingle();
    if(!active)return;
    if(result.error)return; // Keep the saved pointer for reconnecting; no new log is created.
    if(recoveryFromLog(userId,result.data)){setCandidate(rememberWorkout(userId,result.data,saved.label));return;}
    forgetWorkout(userId,saved.logId);setCandidate(null);
   }
   // Also recover sessions started before device markers existed or on another device.
   const result=await supabase.from('workout_logs').select('id,client_id,day_id,created_at,completed_at,cancelled_at,programme_days(name)').eq('client_id',userId).is('completed_at',null).is('cancelled_at',null).order('created_at',{ascending:false}).limit(1).maybeSingle();
   if(!active||result.error||!result.data)return;
   setCandidate(rememberWorkout(userId,result.data,result.data.programme_days?.name));
  })().catch(()=>{/* Saved local recovery still works when the network fails. */});
  return()=>{active=false;};
 },[eligible,userId,online,dismissed,inSession,home]);
 const open=eligible&&home&&!inSession&&!dismissed&&!!candidate;
 useEffect(()=>{if(open&&!ref.current?.open)ref.current?.showModal();else if(!open)ref.current?.close();},[open]);
 return <dialog ref={ref} className="workout-recovery-dialog" aria-labelledby={title} onCancel={()=>setDismissed(true)}>
  <span className="launch-eyebrow">PICK UP WHERE YOU LEFT OFF</span>
  <h2 id={title}>Return to your workout?</h2>
  <p><strong>{candidate?.label}</strong></p>
  <p>Your saved sets, exercise position and timer are kept. The session will open paused.</p>
  {!online&&<p role="status">You’re offline. Connect to reopen this saved session. It will stay saved.</p>}
  <div className="workout-recovery-actions"><button className="btn btn-primary" disabled={!online} onClick={()=>{setDismissed(true);navigate(recoveryPath(candidate));}}>Return to workout</button><button className="btn btn-secondary" onClick={()=>setDismissed(true)}>Not now</button></div>
  <small>Not now keeps the workout unfinished. Nothing is added to your completed stats.</small>
 </dialog>;
}
