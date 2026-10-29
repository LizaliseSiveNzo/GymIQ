import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient.js';
import { useAuth } from '../../context/AuthContext.jsx';
export default function AiReviewCard({ domain }) {
  const {profile}=useAuth();
  const [consent,setConsent]=useState(false),[result,setResult]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const training=domain==='training';
  async function review(withAi){
    if(busy||withAi&&!consent)return;
    setBusy(true);setError('');
    const date=new Date();
    const day=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    try {
      const {data,error}=await supabase.functions.invoke('gymiq-review',{body:{domain,day,offset:date.getTimezoneOffset(),consent:withAi&&consent}});
      if(error)throw error;
      if(!data?.review||!data?.snapshot)throw new Error('Invalid review');
      setResult(data);
    }catch{setError('Your review could not be loaded. Please try the basic review or retry later.');}
    finally{setBusy(false);}
  }
  async function clear(){
    if(busy)return;setBusy(true);setError('');
    try {
      const {error}=await supabase.from('ai_review_cache').delete().eq('user_id',profile.id).eq('review_domain',domain);
      if(error)throw error;
      setResult(null);setConsent(false);
    }catch{setError('Could not remove the saved review. Please try again.');}
    finally{setBusy(false);}
  }
  const s=result?.snapshot;
  const notice=result?.source==='rules'&&result.reason!=='basic_selected' ? {
    not_configured:'AI reviews are not available yet. Your basic review is ready.',
    more_data_needed:'Add more completed records first. Your basic review explains what is missing.',
    membership_required:'AI reviews require active membership. Your basic review is ready.',
    user_limit:'Your fresh AI review limit is reached for today. Your basic review is ready.',
    app_limit:'Today’s AI allowance is used up. Your basic review is ready.',
    busy:'AI reviews are busy right now. Your basic review is ready.',
    provider_limit:'The AI service is at its limit. Your basic review is ready.',
  }[result.reason]||'AI could not complete this review. Your basic review is ready.' : '';
  return <section className="mf-card ai-review-card" aria-label={`${training?'Training':'Calorie'} review`}>
    <div className="section-heading"><h2>{training?'Training insights':'Food & calorie insights'}</h2><span className="badge badge-neutral">Optional</span></div>
    <p className="subtle">{training?'Review recent finished working sets and spot what to focus on next.':'Review logged food and calorie estimates. This is a food-logging review, not a personalised diet prescription.'}</p>
    <label className="ai-review-consent"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/><span>Share a limited numerical summary with Groq for this AI review. Your name, email, date of birth and free-text notes are omitted. <Link to="/privacy#ai-reviews">How reviews use data</Link></span></label>
    <div className="launch-actions"><button className="btn btn-primary" disabled={busy||!consent} onClick={()=>review(true)}>{busy?'Preparing review…':'Review with AI'}</button><button className="btn btn-secondary" disabled={busy} onClick={()=>review(false)}>Basic review</button></div>
    <p className="subtle ai-review-note">AI reviews are limited and reused when the figures are unchanged. Reviews suggest things to consider; they never edit your targets, PRs or Calorie Bank.</p>
    {error&&<p className="inline-error" role="alert">{error}</p>}
    {result&&<div className="ai-review-result" aria-live="polite">
      <div className="row between"><strong>{result.source==='groq'?'Groq AI review':'Basic review · rules-based'}</strong>{result.cached&&<span className="subtle">Saved review</span>}</div>
      {notice&&<p className="subtle" role="status">{notice}</p>}
      <div className="exercise-progress-grid">
        {training?<><div><span>Finished sessions · last 7 days</span><strong>{s.sessions_recent7}</strong></div><div><span>Working sets · last 7 days</span><strong>{s.working_sets_recent7}</strong></div></>:<><div><span>Daily target · estimate</span><strong>{Number(s.daily_target)>0?`${s.daily_target} kcal`:'Not set'}</strong></div><div><span>Food logged today</span><strong>{s.food_kcal_today} kcal</strong><small>{s.food_entries_today} entries · may be incomplete</small></div></>}
      </div>
      {training&&(s.exercises||[]).length>0&&<details className="exercise-progress-history"><summary>Exercises included · recent 90 days</summary>{s.exercises.map(e=><div className="prev-row" key={e.exercise_key}><span>{e.name}</span><strong>{Number(e.last_weight)} kg × {e.last_reps}</strong></div>)}</details>}
      <p>{result.review.summary}</p><p className="ai-review-next"><strong>Next focus</strong><br/>{result.review.suggestion}</p>
      <p className="subtle ai-review-note">Based on the records available when requested · {new Date(result.created_at).toLocaleString()}. {training?'General fitness guidance; choose loads appropriate to your ability.':'Food, targets and activity calories are estimates. Missing logs are not evidence of low intake.'}</p>
      {result.source==='groq'&&<button className="btn btn-ghost" disabled={busy} onClick={clear}>Remove saved AI reviews</button>}
    </div>}
  </section>;
}
