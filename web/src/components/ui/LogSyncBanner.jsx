import {useState} from 'react';
import {useLogSync} from '../../context/LogSyncContext.jsx';
import './quickLogging.css';
export default function LogSyncBanner(){
 const sync=useLogSync(),[removing,setRemoving]=useState(null);
 if(!sync||sync.online&&!sync.pending.length&&!sync.error)return null;
 return <section className="log-sync-banner" aria-label="Log sync status"><div role="status"><strong>{sync.pending.length?`${sync.pending.length} ${sync.pending.length===1?'entry':'entries'} waiting to sync`:sync.online?'Device storage needs attention':'You’re offline'}</strong><p>{sync.pending.length?'Saved on this device. They enter your online diary and stats after sync.':'Keep the app open to log through a connection drop.'}</p>{sync.error&&<p role="alert">{sync.error}</p>}</div>
  {sync.pending.length>0&&<><button className="btn btn-secondary" disabled={!sync.online||sync.syncing} onClick={sync.retry}>{sync.syncing?'Syncing…':'Sync now'}</button><details><summary>Review pending entries</summary>{sync.pending.map(e=><div className="log-sync-entry" key={e.id}><div><strong>{e.payload.name||e.payload.exercise_name}</strong><small>{e.kind==='food'?e.payload.day:'Workout set'} · {e.status==='conflict'?'Needs a decision':e.status==='blocked'?'Needs attention':'Waiting'}{e.message?` · ${e.message}`:''}</small></div><button className="btn btn-ghost" onClick={()=>setRemoving(e)}>Remove queued copy</button></div>)}</details></>}
  {removing&&<div className="log-sync-confirm" role="group" aria-label="Remove queued copy"><p>Remove “{removing.payload.name||removing.payload.exercise_name}” from this device’s queue? This cannot remove anything already saved online. Check your diary or session first if sync was interrupted.</p><button className="btn btn-ghost" onClick={()=>setRemoving(null)}>Keep entry</button><button className="btn btn-secondary" onClick={async()=>{await sync.forget(removing.id);setRemoving(null);}}>Remove queued copy from device</button></div>}
 </section>;
}
