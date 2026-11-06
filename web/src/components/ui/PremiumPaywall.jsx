import {useState} from 'react';
import {Link} from 'react-router-dom';
import {useAuth} from '../../context/AuthContext.jsx';
import {supabase} from '../../lib/supabaseClient.js';
import {loadMembership} from '../../lib/membership.js';
export function RedeemAccessCode({onSuccess}){
 const {profile}=useAuth();const [code,setCode]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 async function redeem(event){
  event.preventDefault();if(busy)return;setBusy(true);setError('');setMessage('');
  try{
   const {data,error}=await supabase.functions.invoke('premium-access',{body:{code}});
   if(error){let detail;try{detail=await error.context.json();}catch{}throw Error(detail?.error||'Could not redeem your code. Connect and try again.');}
   if(!data?.ok)throw Error(data?.error||'This code is unavailable.');
   setCode('');setMessage('Code redeemed. Refreshing premium access…');
   try{const member=await loadMembership(profile.id);window.dispatchEvent(new Event('gymiq-membership-updated'));onSuccess?.(member);setMessage('Premium access is ready. Enjoy GymIQ.');}
   catch{setMessage('Code redeemed. Use Refresh status to update your access.');}
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 return <details className="mf-card account-panel" id="access-code"><summary>Have an access code?</summary><form onSubmit={redeem}><label className="label" htmlFor="premium-code">Access code</label><input id="premium-code" className="input" value={code} onChange={e=>setCode(e.target.value)} maxLength={100} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="GYMIQ-…" required/><button className="btn btn-secondary btn-block" disabled={busy||!code.trim()}>{busy?'Redeeming…':'Unlock premium'}</button></form>{message&&<p role="status">{message}</p>}{error&&<p className="inline-error" role="alert">{error}</p>}</details>;
}
export default function PremiumPaywall({feature='this feature'}){
 return <section className="premium-paywall" aria-label={`Premium: ${feature}`}><div className="training-program account-panel"><span className="launch-eyebrow">GYMIQ PREMIUM</span><h2>More support. More progress.</h2><p>Personalised training programmes, daily meal plans and advanced progress reports.</p><div className="membership-price">R100 <small>/ 30 days</small></div><p>One payment through Yoco. Renew when you choose.</p><Link className="btn btn-primary btn-block" to="/more?upgrade=1#membership">Get premium →</Link><p className="subtle">Freestyle workouts, exercise records and manual food logging stay free.</p></div><RedeemAccessCode/></section>;
}
