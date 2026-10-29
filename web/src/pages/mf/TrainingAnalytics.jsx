import {useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import TabShell from '../../shell/TabShell.jsx';
import {useAuth} from '../../context/AuthContext.jsx';
import {supabase} from '../../lib/supabaseClient.js';
import {loadExerciseProgress} from '../../lib/loadExerciseProgress.js';
import {analyticsStart,buildTrainingAnalytics} from '../../lib/trainingAnalytics.js';
import {dayKey} from '../../../../supabase/functions/_shared/workoutWeek.js';
import TrainingLineChart from '../../components/ui/TrainingLineChart.jsx';
import './trainingAnalytics.css';
const number=value=>Number(value).toLocaleString(undefined,{maximumFractionDigits:2});
const dateLabel=day=>new Date(`${day}T12:00:00`).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});
export default function TrainingAnalytics(){
 const {profile}=useAuth();
 const [data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0),[updated,setUpdated]=useState(null);
 const [period,setPeriod]=useState('4weeks'),[exerciseKey,setExerciseKey]=useState(''),[metric,setMetric]=useState('load'),[supporting,setSupporting]=useState(false),[zeroes,setZeroes]=useState(false),[today,setToday]=useState(dayKey());
 useEffect(()=>{const id=setInterval(()=>setToday(dayKey()),60000);return()=>clearInterval(id);},[]);
 useEffect(()=>{
  if(!profile?.id)return;let cancelled=false;setLoading(true);setError('');
  Promise.all([loadExerciseProgress(()=>cancelled),supabase.from('exercises').select('id,name,primary_muscle_id,secondary_muscle_fraction'),supabase.from('muscles').select('id,name').order('sort_order')]).then(([history,catalogue,muscles])=>{
   if(cancelled)return;if(catalogue.error||muscles.error)throw Error('Metadata unavailable');
   setData({rows:history.flatMap(g=>g.sets),catalogue:catalogue.data||[],muscles:muscles.data||[]});setUpdated(new Date());
  }).catch(()=>{if(!cancelled)setError('Your training graphs could not load. Please retry; your saved workout records are unchanged.');}).finally(()=>{if(!cancelled)setLoading(false);});
  return()=>{cancelled=true;};
 },[profile?.id,retry]);
 const start=analyticsStart(period,today);
 const analytics=useMemo(()=>data?buildTrainingAnalytics(data.rows,data.catalogue,data.muscles,{start,end:today}):null,[data,start,today]);
 const exercise=analytics?.exercises.find(e=>e.key===exerciseKey)||analytics?.exercises[0];
 const points=exercise?.points||[],field=metric==='load'?'load':'bestReps',unit=metric==='load'?'kg':'reps';
 const first=points[0]?.[field],latest=points[points.length-1]?.[field],change=points.length>1?latest-first:null;
 const parts=(analytics?.bodyParts||[]).filter(m=>zeroes||m.primary>0||supporting&&m.supporting>0);
 const maximum=Math.max(1,...parts.map(p=>Math.max(p.primary,supporting?p.supporting:0)));
 return <TabShell title="Training analytics.">
  <div className="analytics-intro"><p>Your completed sets, body-part balance and weight progression in one view.</p><Link to="/workout">← Workouts</Link></div>
  <div className="analytics-toolbar"><label>Period<select value={period} onChange={e=>setPeriod(e.target.value)}><option value="week">This week</option><option value="month">This month</option><option value="4weeks">Last 4 weeks</option><option value="12weeks">Last 12 weeks</option><option value="all">All time</option></select></label><button className="btn btn-secondary" disabled={loading} onClick={()=>setRetry(n=>n+1)}>{loading?'Loading…':'Refresh data'}</button></div>
  <p className="subtle analytics-range">{start?`${dateLabel(start)} – ${dateLabel(today)}`:`All completed history through ${dateLabel(today)}`}{updated?` · Updated ${updated.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}`:''}</p>
  {error&&<p className="inline-error" role="alert">{error}</p>}
  {loading&&!data&&<section className="mf-card" role="status">Loading your completed working sets…</section>}
  {analytics&&<>
   <div className="analytics-overview"><div className="mf-card"><span>Working sets logged</span><strong>{number(analytics.totalSets)}</strong></div><div className="mf-card"><span>Completed sessions</span><strong>{number(analytics.sessions)}</strong></div><div className="mf-card"><span>Exercises performed</span><strong>{number(analytics.exercisesLogged)}</strong></div></div>
   <section className="mf-card analytics-body-parts" aria-label="Sets by body part"><div className="section-heading"><div><span className="analytics-eyebrow">WHERE YOUR WORK GOES</span><h2>Sets by body part</h2></div><span className="badge badge-neutral">Completed working sets</span></div>
    <p className="subtle">Primary sets are assigned to each exercise’s main muscle group. One logged set counts once, including a paired left/right set.</p>
    <div className="analytics-options"><label><input type="checkbox" checked={supporting} onChange={e=>setSupporting(e.target.checked)}/>Show supporting-muscle involvement</label><label><input type="checkbox" checked={zeroes} onChange={e=>setZeroes(e.target.checked)}/>Show body parts with no logged sets</label></div>
    {supporting&&<p className="subtle analytics-method-note">Supporting counts show how often a muscle assisted an exercise. A compound set can support several muscles; these counts are shown separately from primary sets.</p>}
    <div className="analytics-bar-legend"><span><i/>Primary sets</span>{supporting&&<span><i className="supporting"/>Supporting involvement</span>}</div>
    <div className="analytics-bars">{parts.map(p=><div className="analytics-bar-row" key={p.id}><div><strong>{p.name}</strong><span>{p.primary} primary{supporting?` · ${p.supporting} supporting`:''}</span></div><div className="analytics-bar-track"><span style={{width:`${p.primary/maximum*100}%`}}/></div>{supporting&&<div className="analytics-bar-track is-supporting"><span style={{width:`${p.supporting/maximum*100}%`}}/></div>}</div>)}</div>
    {!analytics.totalSets&&<p className="analytics-empty">No completed working sets in this period. {data.rows.length>0?<button className="btn btn-ghost" onClick={()=>setPeriod('all')}>View all time</button>:<Link to="/workout">Start with your first workout →</Link>}</p>}
    {analytics.unmapped>0&&<p className="analytics-method-note">{analytics.unmapped} {analytics.unmapped===1?'set has':'sets have'} no matching body-part tag. They remain in the working-set total.</p>}
   </section>
   <section className="mf-card analytics-weight-progress" aria-label="Exercise weight progression"><span className="analytics-eyebrow">SEE YOUR PROGRESSION</span><h2>Weight & rep trends</h2><p className="subtle">Track one exercise at a time. Each point represents a finished session, with its recorded reps alongside the load.</p>
    {analytics.exercises.length?<><label className="analytics-exercise-select">Exercise<select value={exercise.key} onChange={e=>setExerciseKey(e.target.value)}>{analytics.exercises.map(e=><option key={e.key} value={e.key}>{e.name} · {e.points.length} sessions in range</option>)}</select></label>
     <div className="analytics-metric" aria-label="Graph measure"><button className={`btn ${metric==='load'?'btn-primary':'btn-ghost'}`} aria-pressed={metric==='load'} onClick={()=>setMetric('load')}>Load · kg</button><button className={`btn ${metric==='reps'?'btn-primary':'btn-ghost'}`} aria-pressed={metric==='reps'} onClick={()=>setMetric('reps')}>Reps</button></div>
     <div className="analytics-trend-summary"><div><span>First in range</span><strong>{first==null?'—':`${number(first)} ${unit}`}</strong></div><div><span>Latest in range</span><strong>{latest==null?'—':`${number(latest)} ${unit}`}</strong></div><div><span>Change in range</span><strong>{change==null?'—':`${change>0?'+':''}${number(change)} ${unit}`}</strong><small>{change!=null&&first>0?`${change>0?'+':''}${number(change/first*100)}%`:points.length===1?'Add another session':''}</small></div></div>
     <TrainingLineChart points={points} metric={metric} name={exercise.name}/>
     <p className="subtle analytics-method-note">{metric==='load'?'Load points show the heaviest completed working-set load in each session.':'Rep points show the highest completed working-set reps; check the accompanying load when comparing sessions.'} {exercise.paired?'Paired sets use the lower recorded side load and rep count. kg follows your per-side logging units.':'kg follows the units you entered for this exercise.'} {points.length>0&&points.every(p=>p.load===0)?'For bodyweight work, switch to Reps to follow rep progression.':''}</p>
    </>:<p className="analytics-empty">Log a completed workout to build your first progress line.</p>}
   </section>
   <details className="mf-card analytics-methods"><summary>How these graphs are counted</summary><p>Only valid completed working sets from finished workouts are included. Warm-ups, cancelled sessions, removed exercises and unfinished sessions are excluded. Duplicate records count once. Exercise substitutions are grouped under the exercise actually performed.</p><p>Body-part labels come from the exercise catalogue. Primary and supporting involvement are different views of the same logged work; supporting counts are not additional unique sets or measured muscle activation.</p><p>The vertical axis starts at zero. Weight changes describe the load recorded for that exercise, and should be read with reps and exercise form. Saved targets and coach suggestions count only after you perform and log a set.</p><Link to="/workout/stats">Open exercise records to review or correct a set →</Link></details>
  </>}
 </TabShell>;
}
