export function classifySyncError(error){
 const message=String(error?.message||'');
 if(message.includes('CONFLICT:'))return {status:'conflict',message:message.replace(/^.*CONFLICT:\s*/,'')};
 if(['42501','P0001','23514','22P02','23503','PGRST301'].includes(error?.code)||/membership|sign in|jwt|permission|invalid/i.test(message))return {status:'blocked',message:'This entry needs review or renewed sign-in/membership before syncing.'};
 return {status:'queued',message:'Connection unavailable. Your entry is still on this device.'};
}
export function retryDelay(attempt){return Math.min(300000,2000*2**Math.min(attempt,8));}
export function makeQueuedLog(userId,kind,payload,id,now=Date.now()){
 if(!userId||!['food','set'].includes(kind)||!id||!payload||JSON.stringify(payload).length>16000)throw Error('Check the entry before saving.');
 return {id,userId,kind,payload,createdAt:now,status:'queued',attempts:0,nextAttemptAt:0};
}
// Dependencies are injected so failure/retry behaviour can be verified without a network.
export async function syncQueueBatch({userId,store,send,onSynced=()=>{},now=Date.now,online=()=>true}){
 const entries=(await store.list(userId)).sort((a,b)=>a.createdAt-b.createdAt);
 for(const entry of entries){
  if(!online())break;
  if(entry.userId!==userId||entry.status!=='queued'||entry.nextAttemptAt>now())continue;
  try{
   const result=await send(entry);
   await store.remove(entry.id,userId);
   onSynced({...entry,result});
  }catch(error){
   const failure=classifySyncError(error),attempts=entry.attempts+1;
   await (store.update||store.put)({...entry,...failure,attempts,status:attempts>=8&&failure.status==='queued'?'blocked':failure.status,nextAttemptAt:now()+retryDelay(attempts)});
   if(failure.status==='queued')break;
  }
 }
}
