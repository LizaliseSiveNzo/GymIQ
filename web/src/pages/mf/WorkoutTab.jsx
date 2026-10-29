import {useEffect,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import CalorieBankCard from '../../components/ui/CalorieBankCard.jsx';
import TabShell from '../../shell/TabShell.jsx';
import {useAuth} from '../../context/AuthContext.jsx';
import {loadWorkoutWeek,weekStart,dayKey,addDays} from '../../lib/workoutWeek.js';
import './workoutWeek.css';
const dateLabel=day=>new Date(`${day}T12:00:00`).toLocaleDateString(undefined,{day:'numeric',month:'short'});
export default function WorkoutTab(){
 const {profile}=useAuth();
 const [today,setToday]=useState(dayKey()),[data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const [search,setSearch]=useSearchParams();
 const week=search.get('week')||weekStart(today);
 const setWeek=value=>setSearch(value===weekStart(dayKey())?{}:{week:value});
 const current=weekStart(today),past=week<current;
 useEffect(()=>{const id=setInterval(()=>setToday(dayKey()),30000);return()=>clearInterval(id);},[]);
 useEffect(()=>{if(!profile?.id||profile.demo)return;let active=true;setBusy(true);setError('');
 loadWorkoutWeek({week}).then(d=>{if(active)setData(d);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setBusy(false);});
 return()=>{active=false;};},[profile?.id,week,retry]);
 async function rest(taken=true,rest_date){if(busy)return;setBusy(true);setError('');try{setData(await loadWorkoutWeek({programmeId:data.programme.id,week,action:'rest',taken,rest_date}));}catch(e){setError(e.message);}finally{setBusy(false);}}
 const programme=data?.programme,days=data?.days||[],extras=data?.extras||[],statuses=data?.statuses||{},sessions=data?.sessions||[];
 const completed=days.filter(d=>statuses[d.id]?.complete).length;
 const trainingDates=new Set(sessions.map(s=>s.day));
 const isLoaded=data?.week_start===week;
 return <TabShell active="workout" title="Your training.">
  <div className="training-intro"><p>Your programme, your pace. Make every session count.</p><div className="row" style={{gap:16,flexWrap:'wrap'}}><Link to="/workout/stats">Exercise stats ↗</Link><Link to="/workout/history">History ↗</Link></div></div>
  <Link to="/workout/analytics" className="btn btn-secondary training-analytics-entry"><svg viewBox="0 0 36 36" fill="none" aria-hidden="true"><path d="M5 5v26h26" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="m10 25 6-9 7 4 7-12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="16" cy="16" r="2" fill="currentColor"/><circle cx="23" cy="20" r="2" fill="currentColor"/><circle cx="30" cy="8" r="2" fill="currentColor"/></svg><span><strong>Training analytics</strong><small>Sets by body part · weight & rep graphs</small></span><span aria-hidden="true">↗</span></Link>
  <nav className="workout-week-nav" aria-label="Training week"><button className="btn btn-ghost" aria-label="Previous week" disabled={busy||!data?.first_week||week<=data.first_week} onClick={()=>setWeek(addDays(week,-7))}>←</button><div><strong>{past?'Previous week':'This week'}</strong><span>{dateLabel(week)} – {dateLabel(addDays(week,6))}</span></div><button className="btn btn-ghost" aria-label="Next week" disabled={busy||week>=current} onClick={()=>setWeek(addDays(week,7))}>→</button>{past&&<button className="btn btn-secondary" disabled={busy} onClick={()=>setWeek(current)}>This week</button>}</nav>
  {error&&<p className="inline-error" role="alert">{error} <button className="btn btn-ghost" onClick={()=>setRetry(n=>n+1)}>Try again</button></p>}
  {busy&&!isLoaded&&<div className="mf-card" role="status">Loading your training week…</div>}
  {isLoaded&&<>
   <div className="daystrip">{['M','T','W','T','F','S','S'].map((name,i)=>{const date=addDays(week,i),done=trainingDates.has(date),rested=data.rest_dates?.includes(date);return <div key={date} className={`day-pill ${date===today?'today':''} ${done?'week-calendar-done':rested?'week-calendar-rest':''}`} title={`${date}: ${done?'Workout completed':rested?'Rest taken':'Flexible schedule'}`}><span>{name}</span><span className="d">{Number(date.slice(-2))}</span><span className="day-dot">{done?'✓':rested?'R':''}</span></div>;})}</div>
   {programme?<>
    <div className="training-stats workout-week-stats"><div className="training-stat"><strong>{completed} / {days.length}</strong><span>Workouts completed</span></div><div className="training-stat"><strong>{data.rest_remaining}</strong><span>Rest days {past?'not recorded':'left'}</span></div><div className="training-stat"><strong>{data.rest_target}</strong><span>Rest days planned</span></div></div>
    <div className="training-program workout-week-program row" style={{gap:12,flexWrap:'wrap'}}><span style={{fontSize:26}}>{programme.icon||'💪'}</span><div style={{flex:1}}><h3 style={{margin:0}}>{programme.name}</h3><p className="subtle">{days.length} workouts + {data.rest_target} rest days per week</p></div>{!past&&data.next_day&&<Link className="btn btn-primary" to={`/workout/day/${data.next_day}`}>Start next workout</Link>}</div>
    {data.unfinished&&!past&&<section className="mf-card"><h3>Continue your workout</h3><p className="subtle">Your unfinished session is saved and paused.</p><Link className="btn btn-secondary" to={`/workout/session/${data.unfinished.day_id||'free'}`}>Return to session →</Link></section>}
    <div className="sec-label">Workouts · {past?'week in review':'this week'}</div>
    {!data.full_week&&<p className="subtle">Your programme started partway through this week. Unfinished workouts in this first partial week are not marked missed or carried forward.</p>}
    <div className="workout-week-list">{days.map(d=>{const list=(data.exercises||[]).filter(e=>e.day_id===d.id),status=statuses[d.id]||{},extra=extras.filter(e=>e.day_id===d.id);return <Link key={d.id} to={`/workout/day/${d.id}?week=${week}`} className={`mf-card workout-week-day is-${status.status||'planned'}`} aria-label={`${d.label||''} ${d.name}, ${status.complete?'completed':status.status==='missed'?'missed':'planned'}`}><span className="workout-week-icon">{status.complete?'✓':status.status==='missed'?'!':d.label||d.name[0]}</span><span className="workout-week-copy"><b>{d.label?`${d.label} · `:''}{d.name}</b><span className="subtle">{status.complete?`Completed · ${status.performed?.length||0}/${list.length} exercises performed`:status.status==='missed'?`Missed · ${list.length} exercises`:`${list.length} exercises · ${list.slice(0,2).map(e=>e.name).join(', ')}${list.length>2?'…':''}`}</span></span>{extra.length>0&&<span className="badge badge-neutral">+{extra.length} optional</span>}<span aria-hidden="true">›</span></Link>;})}</div>
    <section className="mf-card workout-rest-card"><div className="section-heading"><h2>Rest & recovery</h2><span className="badge badge-neutral">{data.rest_remaining} / {data.rest_target} {past?'not recorded':'left'}</span></div><p className="subtle">Choose rest days around your schedule. A rest day does not count as a missed workout. Days with a finished workout count as training.</p><div className="workout-week-list">{Array.from({length:data.rest_target},(_,i)=>{const date=data.rest_dates[i];return <div key={i} className={`workout-rest-row ${date?'is-taken':''}`}><span>{date?'✓':'R'}</span><div><strong>Rest day {i+1}</strong><small>{date?`Taken ${dateLabel(date)}`:past?'Not recorded':'Still available this week'}</small></div>{date&&!past&&<button className="btn btn-ghost" disabled={busy||!data.can_write} onClick={()=>rest(false,date)}>Undo</button>}</div>;})}</div>{!past&&data.rest_remaining>0&&<button className="btn btn-secondary" disabled={busy||!data.can_write||trainingDates.has(today)||data.rest_dates.includes(today)} onClick={()=>rest()}>Mark today as rest</button>}{!data.rest_target&&<p className="subtle">Your current programme has no unassigned days. You can adjust the weekly schedule by building a new programme.</p>}</section>
    {extras.length>0&&<section className="mf-card"><h3>Optional make-up exercises</h3><p className="subtle">{extras.length} missed exercises from the previous full week are spread across unstarted sessions. Up to 4 extras per session, 8 across the week, and at most 2 sets each. Extras expire with this week and never build into a backlog. Remove any extra from the session if it does not suit your recovery.</p></section>}
   </>:<div className="mf-card"><h3>No active programme yet</h3><p className="subtle">Build a programme around your goals, schedule and equipment.</p><Link className="btn btn-primary" to="/onboarding?new=1">Build my programme</Link></div>}
  </>}
  <div className="launch-actions" style={{marginTop:18}}><Link className="btn btn-secondary" to="/workout/session/free">+ Freestyle workout</Link><Link className="btn btn-ghost" to="/exercises">Exercise library ↗</Link></div>
  <div className="section-heading"><h2>Fuel your progress</h2><Link to="/bank">Open Calorie Bank ↗</Link></div><CalorieBankCard userId={profile?.id}/>
 </TabShell>;
}
