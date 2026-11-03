import {supabase,storedSession} from './supabaseClient.js';
import {readView,saveView} from './deviceCache.js';
const running=new Map();
export const savedMembership=userId=>readView(userId,'membership',7*86400000);
export function loadMembership(userId){
 if(running.has(userId))return running.get(userId);
 const request=(async()=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  let result;
  try{result=await supabase.rpc('ensure_membership').abortSignal(controller.signal);}finally{clearTimeout(timer);}
  const {data,error}=result;
  const row=Array.isArray(data)?data[0]:data;
  if(error||!row?.expires_at)throw Error('Could not check membership. Connect and try again.');
  if(storedSession()?.user?.id===userId)saveView(userId,'membership',row);return row;
 })().finally(()=>running.delete(userId));
 running.set(userId,request);return request;
}
