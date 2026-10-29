import {supabase} from './supabaseClient.js';
import {makeQueuedLog,syncQueueBatch} from './logQueueCore.js';
let database;const listeners=new Set(),syncListeners=new Set(),running=new Map();
const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('gymiq-log-sync'):null;
const changed=()=>{listeners.forEach(fn=>fn());channel?.postMessage({type:'changed'});};
if(channel)channel.onmessage=({data})=>{if(data.type==='synced')syncListeners.forEach(fn=>fn(data.entry));listeners.forEach(fn=>fn());};
export const subscribeQueue=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
export const subscribeSynced=fn=>{syncListeners.add(fn);return()=>syncListeners.delete(fn);};
function db(){
 if(!database)database=new Promise((resolve,reject)=>{
  const request=indexedDB.open('gymiq-log-queue-v1',1);
  request.onupgradeneeded=()=>{const entries=request.result.createObjectStore('entries',{keyPath:'id'});entries.createIndex('userId','userId');};
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('Device storage is unavailable. Connect and retry before leaving this screen.'));
 });
 return database;
}
async function transaction(mode,operation){
 const database=await db();return new Promise((resolve,reject)=>{
  const tx=database.transaction('entries',mode),store=tx.objectStore('entries');let result;
  operation(store,value=>{result=value;});tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(Error('Could not save on this device. Keep this screen open and retry.'));tx.onabort=()=>reject(Error('Device save was interrupted. Please retry.'));
 });
}
export const queueStore={
 list:userId=>transaction('readonly',(store,done)=>{const r=store.index('userId').getAll(userId);r.onsuccess=()=>done(r.result);}),
 put:entry=>transaction('readwrite',store=>store.put(entry)),
 update:entry=>transaction('readwrite',store=>{const r=store.get(entry.id);r.onsuccess=()=>{if(r.result?.userId===entry.userId)store.put(entry);};}),
 remove:(id,userId)=>transaction('readwrite',store=>{const r=store.get(id);r.onsuccess=()=>{if(r.result?.userId===userId)store.delete(id);};}),
};
export async function queueLog(userId,kind,payload,id=crypto.randomUUID()){
 const entries=await queueStore.list(userId);
 const existing=entries.find(e=>e.id===id);if(existing){if(existing.kind!==kind||JSON.stringify(existing.payload)!==JSON.stringify(payload))throw Error('This entry is already queued. Review it before changing its details.');return existing;}
 if(entries.length>=200)throw Error('Your device queue has 200 entries. Connect and sync before adding more.');
 const entry=makeQueuedLog(userId,kind,payload,id);await queueStore.put(entry);changed();return entry;
}
export async function retryPending(userId){for(const entry of await queueStore.list(userId))if(entry.status!=='conflict')await queueStore.put({...entry,status:'queued',nextAttemptAt:0,attempts:0});changed();return syncPending(userId);}
export async function forgetPending(id,userId){await queueStore.remove(id,userId);changed();}
export function syncPending(userId){
 if(running.has(userId))return running.get(userId);
 const run=syncQueueBatch({userId,store:queueStore,online:()=>navigator.onLine,send:async entry=>{
  const {data:auth}=await supabase.auth.getSession();if(auth.session?.user.id!==userId)throw {code:'42501',message:'Sign in to sync'};
  const {data,error}=await supabase.rpc('sync_log_entry',{p_id:entry.id,p_kind:entry.kind,p_payload:entry.payload});if(error)throw error;return data;
 },onSynced:entry=>{syncListeners.forEach(fn=>fn(entry));channel?.postMessage({type:'synced',entry});}}).finally(()=>{running.delete(userId);changed();});
 running.set(userId,run);return run;
}
