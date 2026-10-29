import {useEffect,useMemo,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import TabShell from '../../shell/TabShell.jsx';
import {useAuth} from '../../context/AuthContext.jsx';
import {loadWeeklyCheckIn} from '../../lib/loadWeeklyCheckIn.js';
import {buildWeeklyCheckIn,reviewWeek,weeklyTargetSuggestions} from '../../lib/weeklyCheckIn.js';
import {dayKey,addDays,weekStart} from '../../lib/workoutWeek.js';
import ExerciseTargetDialog from '../../components/ui/ExerciseTargetDialog.jsx';
import './weeklyCheckIn.css';
const number=value=>value==null?'—':Number(value).toLocaleString(undefined,{maximumFractionDigits:1});
const date=value=>new Date(`${value}T12:00:00`).toLocaleDateString(undefined,{day:'numeric',month:'short'});
export default function WeeklyCheckIn(){
 const {profile}=useAuth();const [search,setSearch]=useSearchParams();
 const [today,setToday]=useState(dayKey()),[data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0),[editing,setEditing]=useState(null),[notice,setNotice]=useState('');
 const week=reviewWeek(search.get('week'),today),latest=addDays(weekStart(today),-7);
 useEffect(()=>{const id=setInterval(()=>setToday(dayKey()),60000);return()=>clearInterval(id);},[]);
 useEffect(()=>{
  if(!profile?.id)return;let cancelled=false;setLoading(true);setError('');setEditing(null);setNotice('');
  loadWeeklyCheckIn(profile.id,week,()=>cancelled).then(result=>{if(!cancelled)setData(result);}).catch(()=>{if(!cancelled)setError('Your weekly check-in could not load. Please retry.');}).finally(()=>{if(!cancelled)setLoading(false);});
  return()=>{cancelled=true;};
 },[profile?.id,week,retry]);
 const loaded=data?.week===week&&data?.userId===profile?.id;
 const review=useMemo(()=>loaded?buildWeeklyCheckIn(data):null,[data,loaded]);
 const suggestions=useMemo(()=>loaded&&week===latest?weeklyTargetSuggestions(data):[],[data,loaded,week,latest]);
 function saved(target,key){setData(old=>({...old,targets:[...old.targets.filter(t=>t.exercise_key!==key),...(target?[target]:[])]}));setNotice('Target saved for future unlogged sets. Your completed workouts and PRs are unchanged.');}
 return <TabShell title="Your weekly check-in.">
  <div className="checkin-intro"><p>A clear look back. A practical next step.</p><Link to="/workout">← Workouts</Link></div>
  <div className="checkin-toolbar"><div className="checkin-period"><span className="subtle">Completed week</span><strong>{date(week)} – {date(addDays(week,6))}</strong></div><button className="btn btn-secondary" disabled={loading} onClick={()=>setRetry(n=>n+1)}>{loading?'Loading…':'Refresh review'}</button></div>
  <nav className="checkin-week-nav" aria-label="Check-in week"><button className="btn btn-ghost" disabled={loading} onClick={()=>setSearch({week:addDays(week,-7)})}>← Previous week</button><button className="btn btn-ghost" disabled={loading||week>=latest} onClick={()=>setSearch({week:addDays(week,7)})}>Next week →</button></nav>
  <p className="subtle">Monday–Sunday{week!==latest?' · Historical review':' · Latest completed week'}</p>
  {error&&<p className="inline-error" role="alert">{error}</p>}
  {loading&&!loaded&&<section className="mf-card" role="status">Bringing your training, weight and food records together…</section>}
  {notice&&<p className="checkin-notice" role="status">{notice}</p>}
  {review&&<div className="checkin-report" aria-busy={loading}>
   <section className="mf-card checkin-headline"><span className="checkin-eyebrow">YOUR WEEK AT A GLANCE</span><h2>{review.sessions?`${review.sessions} ${review.sessions===1?'session':'sessions'}. Every logged set matters.`:'Your next week starts with one step.'}</h2><p>{review.sets} completed working sets{review.previousSets?` · ${review.sets-review.previousSets>0?'+':''}${review.sets-review.previousSets} compared with the week before`:'. The previous week has no working-set baseline.'}</p><p className="subtle">More sets alone do not mean better progress. Quality, recovery and a repeatable routine matter.</p></section>
   <div className="checkin-grid">
    <section className="mf-card"><span className="checkin-eyebrow">CONSISTENCY</span><h2>Training & recovery</h2><strong className="checkin-value">{review.plannedDays!=null?`${review.completeDays} / ${review.plannedDays}`:review.sessions}</strong><p>{review.plannedDays!=null?'programme workouts completed':'finished sessions with working sets'}</p><p className="subtle">{review.plannedDays!=null?`Compared with your current reference programme: ${review.programmeName}. Historical schedules may differ if you edited your programme.`:'No full-week programme baseline is available for this week.'} Freestyle sessions count in your session total.</p><Link to={`/workout?week=${week}`}>Review workouts & rest days →</Link></section>
    <section className="mf-card"><span className="checkin-eyebrow">WEIGHT TREND</span><h2>Look beyond one weigh-in</h2><strong className="checkin-value">{number(review.weight.average)}{review.weight.average!=null?' kg':''}</strong><p>{review.weight.count} weigh-ins this week · {review.weight.previousCount} the week before</p><p className="subtle">{review.weight.change!=null?`${review.weight.change>0?'+':''}${number(review.weight.change)} kg between weekly averages. This describes scale weight, not a measured fat-loss result.`:'At least two weigh-ins in each week are needed to compare weekly averages. No weight change is inferred from missing measurements.'}</p><Link to="/bank">Add a weigh-in →</Link></section>
   </div>
   <section className="mf-card"><span className="checkin-eyebrow">STRENGTH IN CONTEXT</span><h2>Your weights & reps</h2><p className="subtle">Latest session this week versus the latest session the week before, for the same exercise. Paired sets use the lower side. Compare reps and form alongside kg.</p>
    {review.strength.length?<div className="checkin-table-wrap"><table className="checkin-table"><thead><tr><th>Exercise</th><th>Previous</th><th>This week</th><th>Load change</th></tr></thead><tbody>{review.strength.map(e=><tr key={e.key}><th scope="row">{e.name}</th><td>{e.before?`${number(e.before.weight)} kg × ${e.before.reps}`:'No baseline'}</td><td>{number(e.latest.weight)} kg × {e.latest.reps}</td><td>{e.change==null?'—':`${e.change>0?'+':''}${number(e.change)} kg`}</td></tr>)}</tbody></table></div>:<p className="subtle">No completed working sets to compare this week.</p>}<Link to="/workout/analytics">Explore your progress graphs →</Link>
   </section>
   <section className="mf-card"><span className="checkin-eyebrow">FOOD LOG COVERAGE</span><h2>{review.nutrition.complete} / 7 days marked complete</h2><div className="checkin-food-days">{review.nutrition.days.map(d=><div key={d.day} className={d.complete?'is-complete':''}><strong>{date(d.day)}</strong><span>{d.complete?`${number(d.kcal)} kcal`:d.entries?'Partial log':'Not confirmed'}</span></div>)}</div>
    <p>Average intake on complete days: <strong>{review.nutrition.average==null?'Not available':`${number(review.nutrition.average)} kcal`}</strong>.</p>
    <p className="subtle">{review.nutrition.comparable?`${review.nutrition.comparable} complete days also have a dated calorie guide. Their average difference is ${review.nutrition.difference>0?'+':''}${number(review.nutrition.difference)} kcal/day (intake minus guide). This describes those days only, not your whole-week deficit.`:'There are no complete days with a dated calorie guide to compare.'} Unconfirmed days are unknown, even when nothing is logged. Meal plans do not count as food eaten.</p>
    <p className="subtle">Return to your usual plan after an unplanned meal. Review your patterns across well-recorded weeks.</p><Link to="/bank?goals=1">Review my calorie goal →</Link>
   </section>
   <section className="mf-card"><span className="checkin-eyebrow">FOCUS FOR THE COMING WEEK</span><h2>Keep it achievable</h2><ul className="checkin-priorities">{review.priorities.map(p=><li key={p}>{p}</li>)}</ul></section>
   <section className="mf-card"><span className="checkin-eyebrow">REVIEW BEFORE APPLYING</span><h2>Next-session targets</h2><p className="subtle">These use your latest completed exercise history and effort ratings, including sessions after the reviewed week. Nothing changes until you review and save a target. Saved targets prefill future unlogged sets until changed or cleared in Exercise stats.</p>
    {suggestions.map(item=>{const target=data.targets.find(t=>t.exercise_key===item.key),s=item.suggestion,already=target&&Number(target.weight)===s.weight&&Number(target.reps)===s.reps;return <article className="checkin-suggestion" key={item.key}><div><h3>{item.name}</h3><strong>{number(s.weight)} kg × {s.reps} reps</strong><p>{s.reason}</p>{target&&<small>Current saved target: {number(target.weight)} kg × {target.reps}. Saving replaces it.</small>}</div><button className="btn btn-secondary" disabled={loading||!!error||already} onClick={()=>setEditing({...item,weight:s.weight,reps:s.reps})}>{already?'Target saved':'Review target'}</button></article>;})}
    {!suggestions.length&&<p className="subtle">{week!==latest?'Open the latest completed week for current recommendations.':'No specific target changes are supported by your current records. Keep logging full working sets and rate their effort; the session coach also checks today’s readiness.'}</p>}
    {week!==latest&&<button className="btn btn-secondary" onClick={()=>setSearch({})}>Latest completed week</button>}<p><Link to="/workout/stats">View or edit all saved targets →</Link></p>
   </section>
   <details className="mf-card"><summary>How this check-in works</summary><p>This is a live, rules-based review of your saved records. It refreshes when records are corrected; it is not a frozen report. Only finished, non-cancelled workouts and completed working sets count. Warm-ups and removed exercises are excluded.</p><p>Recommendations reuse the progression coach’s conservative checks. Your programme, calorie goal and historical records only change through their existing review controls. No personal records are sent to an AI provider for this check-in.</p></details>
  </div>}
  <ExerciseTargetDialog exercise={editing} target={null} onClose={()=>setEditing(null)} onSaved={saved}/>
 </TabShell>;
}
