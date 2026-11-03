import {supabase,storedSession} from './supabaseClient.js';
import {readView,saveView,offlineWeek} from './deviceCache.js';
export {weekStart,dayKey,addDays,exerciseIdentity,dayProgress} from '../../../supabase/functions/_shared/workoutWeek.js';
export const savedWorkoutWeek=(userId,week,programmeId)=>readView(userId,`week:${week}:${programmeId||'active'}`);
export async function loadWorkoutWeek({programmeId,week,userId=storedSession()?.user?.id,action='week',...extra}={}){
 const saved=action==='week'?savedWorkoutWeek(userId,week,programmeId):null;
 if(!navigator.onLine){if(saved)return offlineWeek(saved.data);throw Error('Connect to load this workout for the first time.');}
 const {data,error}=await supabase.functions.invoke('gymiq-workout-week',{timeout:10000,body:{programme_id:programmeId,week,action,offset:new Date().getTimezoneOffset(),...extra}});
 if(error||data?.error){
  if(saved)return offlineWeek(saved.data);
  let message=data?.error;try{message||=(await error.context.json()).error;}catch{/* network failure */}
  throw Error(message||'Your training week could not load. Please try again.');
 }
 if(storedSession()?.user?.id===userId){
  saveView(userId,`week:${week}:${programmeId||'active'}`,data);
  if(data?.programme?.id)saveView(userId,`week:${week}:${data.programme.id}`,data);
  if(!programmeId&&data?.programme?.id)saveView(userId,'last-training-week',data);
 }
 return data;
}
