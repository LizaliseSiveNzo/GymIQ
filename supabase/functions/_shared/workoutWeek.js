export const MAX_EXTRAS_PER_SESSION=4, MAX_EXTRAS_PER_WEEK=8;
export function dayKey(date=new Date()) {return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function addDays(day,n){const d=new Date(`${day}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function weekStart(day=dayKey()){const dow=new Date(`${day}T12:00:00Z`).getUTCDay();return addDays(day,-((dow+6)%7));}
export const exerciseIdentity=e=>e.exercise_id||`name:${String(e.name||e.exercise_name||'').trim().toLowerCase()}`;
export function performedExercises(sessions){return new Set(sessions.flatMap(s=>(s.sets||[]).map(exerciseIdentity)));}
export function performedSlots(sessions){return new Set(sessions.flatMap(s=>(s.sets||[]).map(e=>e.programme_exercise_id).filter(Boolean)));}
export function makeUpExercises(days, exercises, previousSessions, currentSessions, blockedDays=[], sourceWeek){
  const previous=performedExercises(previousSessions),current=performedExercises(currentSessions);
  const previousSlots=performedSlots(previousSessions),currentSlots=performedSlots(currentSessions);
  const blocked=new Set([...blockedDays,...currentSessions.map(s=>s.day_id)]);
  const destinations=days.filter(d=>!blocked.has(d.id));
  const assignments=new Map(destinations.map(d=>[d.id,[]]));
  const seen=new Set(),candidates=[];
  // Round-robin source days so one missed workout cannot consume the whole allowance.
  const queues=days.map(d=>exercises.filter(e=>e.day_id===d.id));
  for(let i=0;i<Math.max(0,...queues.map(q=>q.length));i++)for(const q of queues){
    const e=q[i];if(!e)continue;const key=exerciseIdentity(e);
    if(previous.has(key)||current.has(key)||previousSlots.has(e.id)||currentSlots.has(e.id)||seen.has(key))continue;
    seen.add(key);candidates.push(e);
  }
  const extras=[];
  for(const e of candidates){
    if(extras.length>=MAX_EXTRAS_PER_WEEK)break;
    const key=exerciseIdentity(e);
    const available=destinations.filter(d=>assignments.get(d.id).length<MAX_EXTRAS_PER_SESSION&&!exercises.some(base=>base.day_id===d.id&&exerciseIdentity(base)===key));
    available.sort((a,b)=>assignments.get(a.id).length-assignments.get(b.id).length);
    if(!available.length)continue;
    const destination=available[0];
    const extra={...e,id:`makeup_${e.id}`,source_exercise_id:e.id,source_week:sourceWeek,day_id:destination.id,optional:true,target_sets:Math.min(2,Math.max(1,Number(e.target_sets)||2)),target_rir:Math.max(2,Number(e.target_rir)||2)};
    assignments.get(destination.id).push(extra);extras.push(extra);
  }
  return extras;
}
export function dayProgress(day,exercises,sessions,past=false){
  const performed=performedExercises(sessions);
  const slots=performedSlots(sessions);
  const done=exercises.filter(e=>performed.has(exerciseIdentity(e))||slots.has(e.id));
  const finished=sessions.some(s=>s.day_id===day.id);
  const complete=finished;
  return {complete,performed:done.map(e=>e.id),missing:exercises.filter(e=>!performed.has(exerciseIdentity(e))&&!slots.has(e.id)).map(e=>e.id),status:complete?'complete':past?'missed':'planned'};
}
