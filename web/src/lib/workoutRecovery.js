import {readView,saveView,removeView} from './deviceCache.js';
export const validLogId=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function recoveryFromLog(userId,log,label){
 if(!userId||log?.client_id!==userId||!validLogId(log.id)||log.completed_at||log.cancelled_at||log.day_id!=null&&!validLogId(log.day_id))return null;
 return {logId:log.id,dayId:log.day_id||null,startedAt:log.created_at||null,
  label:typeof label==='string'&&label.trim()?label.trim().slice(0,100):log.day_id?'Your workout':'Freestyle workout'};
}
export function recoveryPath(pointer){
 if(!validLogId(pointer?.logId)||pointer.dayId!=null&&!validLogId(pointer.dayId))throw Error('Invalid saved workout.');
 return `/workout/session/${pointer.dayId||'free'}?resume=${pointer.logId}`;
}
export function savedWorkoutRecovery(userId){
 const pointer=readView(userId,'workout-recovery')?.data;
 try{recoveryPath(pointer);return pointer;}catch{return null;}
}
export function rememberWorkout(userId,log,label){
 const pointer=recoveryFromLog(userId,log,label);if(!pointer)return;
 saveView(userId,'workout-recovery',pointer);return pointer;
}
export function forgetWorkout(userId,logId){
 if(savedWorkoutRecovery(userId)?.logId===logId)removeView(userId,'workout-recovery');
}
export function resumableLog(userId,log,dayId){
 return !!recoveryFromLog(userId,log)&&((log.day_id||null)===(dayId||null));
}
export async function loadResumedWorkout(client,{userId,dayId,resumeId}){
 if(resumeId===null)return null;
 if(!validLogId(resumeId))throw Error('This saved session link is invalid. Return to Training.');
 const result=await client.from('workout_logs').select('*').eq('client_id',userId).eq('id',resumeId).maybeSingle();
 if(result.error)throw Error('Could not reopen your saved session. Reconnect and try again.');
 if(!resumableLog(userId,result.data,dayId)){
  forgetWorkout(userId,resumeId);
  throw Error('This session has ended or is no longer available. Your completed workouts remain in History.');
 }
 return result.data;
}
