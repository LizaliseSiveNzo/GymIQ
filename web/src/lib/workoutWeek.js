import {supabase} from './supabaseClient.js';
export {weekStart,dayKey,addDays,exerciseIdentity,dayProgress} from '../../../supabase/functions/_shared/workoutWeek.js';
export async function loadWorkoutWeek({programmeId,week,action='week',...extra}={}){
 const {data,error}=await supabase.functions.invoke('gymiq-workout-week',{body:{programme_id:programmeId,week,action,offset:new Date().getTimezoneOffset(),...extra}});
 if(error){let message;try{message=(await error.context.json()).error;}catch{/* network failure */}throw Error(message||'Your training week could not load. Please try again.');}
 if(data?.error)throw Error(data.error);return data;
}
