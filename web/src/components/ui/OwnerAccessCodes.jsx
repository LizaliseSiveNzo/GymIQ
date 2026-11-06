import {useState} from 'react';
import {supabase} from '../../lib/supabaseClient.js';
const date=value=>new Date(value).toLocaleDateString('en-ZA');
export default function OwnerAccessCodes(){
 const [codes,setCodes]=useState([]),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[created,setCreated]=useState(''),[copied,setCopied]=useState(false),[revoking,setRevoking]=useState(null);
 const [form,setForm]=useState({label:'',days:30,max_uses:1,valid_days:30,email:''});
 async function action(body){
  if(busy)return;setBusy(true);setError('');
  try{
   const {data,error}=await supabase.functions.invoke('owner-dashboard',{body});
   if(error){let detail;try{detail=await error.context.json();}catch{}throw Error(detail?.error||'Could not update access codes. Please try again.');}
   setCodes(data.codes||[]);setLoaded(true);if(data.code){setCreated(data.code);setCopied(false);}setRevoking(null);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 const field=(key,value)=>setForm(previous=>({...previous,[key]:value}));
 async function copy(){try{await navigator.clipboard.writeText(created);setCopied(true);}catch{setError('Select and copy the code below.');}}
 return <details className="mf-card account-panel owner-access-codes" onToggle={e=>{if(e.currentTarget.open&&!loaded&&!busy)void action({action:'codes'});}}><summary>Premium access codes</summary><p className="subtle">Invite testers, friends or promotion partners. Codes unlock premium features without creating a payment.</p>
  <form onSubmit={e=>{e.preventDefault();void action({action:'create_code',...form});}}>
   <label className="label" htmlFor="code-label">Label</label><input id="code-label" className="input" required maxLength={80} value={form.label} onChange={e=>field('label',e.target.value)} placeholder="e.g. Launch testers"/>
   <div className="owner-code-settings">{[['days','Premium days',365],['max_uses','Maximum people',100],['valid_days','Redeem within (days)',90]].map(([key,label,max])=><label key={key}>{label}<input className="input" type="number" min={1} max={max} required value={form[key]} onChange={e=>field(key,e.target.value===''?'':Number(e.target.value))}/></label>)}</div>
   <label className="label" htmlFor="code-email">Restrict to an email (optional)</label><input id="code-email" className="input" type="email" maxLength={254} value={form.email} onChange={e=>field('email',e.target.value)} placeholder="Leave blank for any signed-in account"/>
   <button className="btn btn-primary btn-block" disabled={busy}>{busy?'Updating…':'Create access code'}</button>
  </form>
  {created&&<section className="mf-card" role="status"><strong>Save this code now</strong><p className="subtle">The full code is shown once. Share it privately with your recipient.</p><input className="input" readOnly aria-label="New access code" value={created} onFocus={e=>e.target.select()}/><button className="btn btn-secondary" onClick={copy}>{copied?'Copied':'Copy code'}</button><button className="btn btn-ghost" onClick={()=>setCreated('')}>Dismiss</button></section>}
  {error&&<p className="inline-error" role="alert">{error}</p>}
  <div className="owner-user-list">{codes.map(code=><article key={code.id}><strong>{code.label}</strong><p className="subtle">•••• {code.hint} · {code.days} premium days · {code.uses}/{code.max_uses} used</p><p className="subtle">{code.revoked_at?'Revoked':`Redeem by ${date(code.expires_at)}`} · {code.active_grants} active invites{code.bound_email?` · ${code.bound_email}`:''}</p>{!code.revoked_at&&(revoking===code.id?<div><p>Revoke this code and end the premium access it granted? Paid access remains valid.</p><button className="btn btn-secondary" disabled={busy} onClick={()=>action({action:'revoke_code',id:code.id})}>Confirm revoke</button><button className="btn btn-ghost" disabled={busy} onClick={()=>setRevoking(null)}>Keep code</button></div>:<button className="btn btn-ghost" disabled={busy} onClick={()=>setRevoking(code.id)}>Revoke</button>)}</article>)}</div>
  {loaded&&!codes.length&&<p className="subtle">No access codes yet.</p>}
  <button className="btn btn-ghost" disabled={busy} onClick={()=>action({action:'codes'})}>Refresh codes</button>
 </details>;
}
