import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase, setRemember } from '../lib/supabaseClient.js';
import { CONSENT_VERSION } from '../lib/legal.js';

export default function Login() {
 const [params] = useSearchParams();
 const [mode,setMode] = useState(params.get('mode')==='register'?'register':'login');
 const [name,setName] = useState(''), [email,setEmail] = useState(''), [password,setPassword] = useState('');
 const [consent,setConsent] = useState(false), [remember,setRememberMe] = useState(true);
 const [busy,setBusy] = useState(false), [error,setError] = useState(''), [notice,setNotice] = useState('');
 const { signIn,signUp } = useAuth();
 const navigate = useNavigate();
 useEffect(() => {
   const { data } = supabase.auth.onAuthStateChange(event => { if(event==='PASSWORD_RECOVERY') setMode('update'); });
   return () => data.subscription.unsubscribe();
 }, []);
 async function submit(e) {
   e.preventDefault(); setBusy(true); setError(''); setNotice('');
   try {
     if(mode==='reset') {
       const result=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin+'/login?recovery=1'});
       if(result.error) throw result.error;
       setNotice('If an account exists for this email, a password reset link will arrive shortly.');
     } else if(mode==='update') {
       const result=await supabase.auth.updateUser({password});
       if(result.error) throw result.error;
       setPassword(''); navigate('/workout',{replace:true});
     } else if(mode==='register') {
       if(!consent) throw new Error('Please accept the privacy policy and terms.');
       const result=await signUp({name:name.trim(),email:email.trim(),password,role:'player',consent:true,consentVersion:CONSENT_VERSION});
       if(result.error) throw new Error(result.error);
       if(result.needsConfirmation) {setNotice('Check your email to confirm your account, then sign in.');setMode('login');setPassword('');}
       else navigate('/workout',{replace:true});
     } else {
       setRemember(remember);
       const result=await signIn({email:email.trim(),password});
       if(result.error) throw new Error(result.error);
       navigate('/workout',{replace:true});
     }
   } catch(e) {setError(e.message||'Something went wrong. Please try again.');}
   finally {setBusy(false);}
 }
 const titles={login:'Welcome back.',register:'Make your next move.',reset:'Reset your password.',update:'Choose a new password.'};
 return <div className="auth">
   <aside className="auth-brand"><Link to="/" className="app-wordmark">GYM<span>IQ</span></Link><div><div className="launch-eyebrow">YOUR DAILY EDGE</div><h2>Your next chapter starts with a set.</h2><p>Personal workouts. Every set recorded. Calorie Bank alongside you.</p></div><p className="launch-caption">Workouts first. Fuel in focus.</p></aside>
   <main className="auth-panel"><div className="auth-card">
     <Link to="/" className="app-wordmark" style={{marginBottom:32}}>GYM<span>IQ</span></Link>
     {['login','register'].includes(mode) && <div className="auth-tabs">{['login','register'].map(m=><button key={m} type="button" className={m===mode?'selected':''} onClick={()=>{setMode(m);setError('');setNotice('');}}>{m==='login'?'Sign in':'Create account'}</button>)}</div>}
     <h1 style={{fontSize:28,letterSpacing:'-.04em'}}>{titles[mode]}</h1>
     <p className="subtle">{mode==='register'?'Your workouts and Calorie Bank. Start with 7 days free.':mode==='login'?'Pick up where you left off.':'Get back to your training.'}</p>
     <form onSubmit={submit}>
       {mode==='register' && <div className="field"><label className="label" htmlFor="auth-name">Name</label><input id="auth-name" className="input" required autoComplete="name" maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></div>}
       {mode!=='update' && <div className="field"><label className="label" htmlFor="auth-email">Email</label><input id="auth-email" className="input" type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></div>}
       {mode!=='reset' && <div className="field"><label className="label" htmlFor="auth-password">Password</label><input id="auth-password" className="input" type="password" required minLength={mode==='login'?1:8} autoComplete={mode==='login'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)}/></div>}
       {mode==='login' && <div className="row between" style={{marginBottom:18,gap:10,flexWrap:'wrap'}}><label style={{fontSize:12,display:'flex',gap:6,alignItems:'center'}}><input type="checkbox" checked={remember} onChange={e=>setRememberMe(e.target.checked)}/>Keep me signed in</label><button type="button" className="auth-text-button" onClick={()=>{setMode('reset');setError('');}}>Forgot password?</button></div>}
       {mode==='register' && <label className="auth-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>I am 18 or older and accept the <Link to="/privacy" target="_blank" rel="noopener noreferrer">privacy policy and membership terms</Link>.</span></label>}
       {error && <p className="inline-error" role="alert">{error}</p>}
       {notice && <p className="mf-card" role="status">{notice}</p>}
       <button className="btn btn-primary btn-lg btn-block" disabled={busy||(mode==='register'&&!consent)}>{busy?'Please wait…':mode==='reset'?'Send reset link':mode==='update'?'Save password':mode==='register'?'Create my account ↗':'Sign in ↗'}</button>
     </form>
     {mode==='reset' && <button className="btn btn-ghost btn-block" onClick={()=>setMode('login')}>Back to sign in</button>}
     <p className="launch-caption" style={{textAlign:'center',marginTop:24}}><Link to="/privacy">Privacy & terms</Link> · GymIQ</p>
   </div></main>
 </div>;
}
