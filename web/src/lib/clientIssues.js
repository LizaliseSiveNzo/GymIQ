import {supabase} from './supabaseClient.js';
const reported=new Map();
export function reportClientIssue(userId,kind){
 if(!userId||!navigator.onLine||!['sync_failed','workout_save_failed'].includes(kind))return;
 const key=`${userId}:${kind}`,now=Date.now();
 if(reported.has(key)&&now-reported.get(key)<600000)return;
 reported.set(key,now);
 try{void Promise.resolve(supabase.rpc('record_client_issue',{p_kind:kind})).catch(()=>{});}catch{/* Reporting must never interrupt workout saving. */}
}
