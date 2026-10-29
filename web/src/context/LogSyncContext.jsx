import {createContext,useContext,useEffect,useState} from 'react';
import {useAuth} from './AuthContext.jsx';
import {queueStore,queueLog,syncPending,retryPending,forgetPending,subscribeQueue,subscribeSynced} from '../lib/logQueue.js';
const Context=createContext(null);
export const useLogSync=()=>useContext(Context);
export function LogSyncProvider({children}){
 const {profile}=useAuth(),userId=profile?.id;
 const [pending,setPending]=useState([]),[online,setOnline]=useState(navigator.onLine),[error,setError]=useState(''),[syncing,setSyncing]=useState(false);
 useEffect(()=>{
  let active=true;setPending([]);setError('');
  async function refresh(){if(!userId)return;try{const entries=await queueStore.list(userId);if(active)setPending(entries);}catch(e){if(active)setError(e.message);}}
  async function flush(){if(!userId||!navigator.onLine)return;try{await syncPending(userId);}catch(e){if(active)setError(e.message);}await refresh();}
  const remove=subscribeQueue(refresh),synced=subscribeSynced(refresh);
  const connection=()=>{setOnline(navigator.onLine);if(navigator.onLine)void flush();};
  window.addEventListener('online',connection);window.addEventListener('offline',connection);
  const interval=setInterval(flush,15000);void refresh();void flush();
  return()=>{active=false;remove();synced();clearInterval(interval);window.removeEventListener('online',connection);window.removeEventListener('offline',connection);};
 },[userId]);
 async function enqueue(kind,payload,id){if(!userId)throw Error('Sign in before logging.');const entry=await queueLog(userId,kind,payload,id);setPending(await queueStore.list(userId));void syncPending(userId).catch(e=>setError(e.message));return entry;}
 async function retry(){if(!userId||syncing)return;setSyncing(true);setError('');try{await retryPending(userId);}catch(e){setError(e.message);}finally{setSyncing(false);}}
 return <Context.Provider value={{pending:pending.filter(e=>e.userId===userId),online,error,syncing,enqueue,retry,forget:id=>forgetPending(id,userId)}}>{children}</Context.Provider>;
}
