import {validSetNumbers} from './setNumbers.js';
export const workingRows=rows=>(rows||[]).filter(row=>row.completed!==false&&row.set_type!=='warmup');
// Row identity is its recorded set number, never its current array position.
export function numberedSets(rows){
 const result=new Map();
 const warmups=new Set((rows||[]).filter(row=>row.set_type==='warmup').map(row=>Number(row.set_number)).filter(n=>Number.isInteger(n)&&n>0));
 for(const row of workingRows(rows)){
  const ordinal=Number(row.set_number);if(!Number.isInteger(ordinal)||ordinal<1||ordinal>1000)continue;
  const n=ordinal-[...warmups].filter(w=>w<ordinal).length;
  const existing=result.get(n);
  if(!existing||existing._queued&&!row._queued)result.set(n,row);
 }
 return result;
}
export function numberForWorkingRow(displayNumber,rows){
 const occupied=new Set((rows||[]).filter(row=>row.set_type==='warmup').map(row=>Number(row.set_number)));
 let ordinal=0,working=0;
 while(working<displayNumber){ordinal++;if(!occupied.has(ordinal))working++;if(ordinal>1000)throw Error('This exercise has reached the set limit.');}
 return ordinal;
}
export function parseSetDraft(draft){
 const weight=String(draft?.kg??'').trim().replace(',','.');
 const reps=String(draft?.reps??'').trim();
 if(!validSetNumbers(weight,reps))throw Error('Enter 0–9999.99 kg and 1–1000 whole reps. Use 0 kg for bodyweight.');
 const rir=draft.rir==null||draft.rir===''?null:Number(draft.rir);
 if(rir!==null&&(!Number.isInteger(rir)||rir<0||rir>10))throw Error('RIR must be a whole number from 0–10.');
 return {weight:Number(weight),reps:Number(reps),rir};
}
export function upsertSessionSet(rows,row){
 const existing=(rows||[]).find(s=>s.id===row.id);
 // A late device-save update must not turn an acknowledged row back into pending.
 if(existing&&!existing._queued&&row._queued)return rows;
 return [...(rows||[]).filter(s=>s.id!==row.id),row].sort((a,b)=>a.set_number-b.set_number);
}
export async function saveSetOnce({locks,key,save}){
 if(locks.has(key))return null;
 locks.add(key);
 try{return await save();}finally{locks.delete(key);}
}
export function acceptSetTap(timestamps,key,now=Date.now()){
 if(Number.isFinite(timestamps[key])&&now-timestamps[key]<700)return false;
 timestamps[key]=now;return true;
}
export async function runSessionWrite(operation,ms=12000){
 const controller=new AbortController();let timer;
 const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Connection interrupted. Your saved values may have updated; reconnect and check before retrying.'));},ms);});
 try{return await Promise.race([Promise.resolve().then(()=>operation(controller.signal)),timeout]);}finally{clearTimeout(timer);}
}
