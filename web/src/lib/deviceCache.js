// Presentation snapshots only. Server auth, membership checks and RLS still
// authorise every write. Pending logs live separately in the durable log queue.
export const DEVICE_PREFIX='gymiq-view-v1:';
export const SNAPSHOT_AGE=30*86400000;
const stores=()=>{try{return [localStorage,sessionStorage];}catch{return [];}};
function preferred(){try{return localStorage.getItem('gymiq_remember')==='false'?sessionStorage:localStorage;}catch{return null;}}
export function readView(userId,key,maxAge=SNAPSHOT_AGE,now=Date.now()){
 if(!userId)return null;
 for(const storage of stores())try{
  const raw=JSON.parse(storage.getItem(`${DEVICE_PREFIX}${userId}:${key}`)||'null');
  if(raw?.userId===userId&&Number.isFinite(raw.savedAt)&&now>=raw.savedAt&&now-raw.savedAt<=maxAge)return raw;
 }catch{/* Corrupt/blocked storage must never stop app startup. */}
 return null;
}
export function saveView(userId,key,data,now=Date.now()){
 if(!userId)return;
 try{const target=preferred(),cacheKey=`${DEVICE_PREFIX}${userId}:${key}`;target?.setItem(cacheKey,JSON.stringify({userId,savedAt:now,data}));for(const storage of stores())if(storage!==target)storage.removeItem(cacheKey);}catch{/* Optional snapshots may be evicted; never evict queued logs. */}
}
export function clearViews(userId){
 if(!userId)return;
 for(const storage of stores())try{for(const key of Object.keys(storage))if(key.startsWith(`${DEVICE_PREFIX}${userId}:`))storage.removeItem(key);}catch{/* Best effort, current UI is cleared separately. */}
}
export function profileSnapshot(profile){return Object.fromEntries(['id','name','email','role','onboarded_at'].filter(k=>Object.hasOwn(profile,k)).map(k=>[k,profile[k]]));}
export function offlineWeek(snapshot){return {...snapshot,can_write:false,fromDevice:true};}
