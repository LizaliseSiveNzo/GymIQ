import {useEffect,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import TabShell from '../../shell/TabShell.jsx';
import {useAuth} from '../../context/AuthContext.jsx';
import TrainingMenu from '../../components/ui/TrainingMenu.jsx';
import {loadWorkoutWeek,savedWorkoutWeek,weekStart,dayKey,addDays} from '../../lib/workoutWeek.js';
import {offlineWeek,readView} from '../../lib/deviceCache.js';
import './workoutWeek.css';
import useMembership from '../../hooks/useMembership.js';
import PremiumPaywall from '../../components/ui/PremiumPaywall.jsx';
const dateLabel=day=>new Date(`${day}T12:00:00`).toLocaleDateString(undefined,{day:'numeric',month:'short'});
function ProgrammeWorkoutTab(){
 const {profile}=useAuth();
 const [today,setToday]=useState(dayKey()),[data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const [search,setSearch]=useSearchParams();
 const week=search.get('week')||weekStart(today);
 const setWeek=value=>setSearch(value===weekStart(dayKey())?{}:{week:value});
 const current=weekStart(today),past=week<current;
 useEffect(()=>{const id=setInterval(()=>setToday(dayKey()),30000);return()=>clearInterval(id);},[]);
 useEffect(()=>{if(!profile?.id||profile.demo)return;let active=true;
 const load=()=>{setBusy(true);setError('');const saved=savedWorkoutWeek(profile.id,week);setData(saved?offlineWeek(saved.data):null);
 loadWorkoutWeek({week,userId:profile.id}).then(d=>{if(active)setData(d);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setBusy(false);});};
 load();window.addEventListener('online',load);
 return()=>{active=false;window.removeEventListener('online',load);};},[profile?.id,week,retry]);
 async function rest(taken=true,rest_date){if(busy)return;setBusy(true);setError('');try{setData(await loadWorkoutWeek({programmeId:data.programme.id,week,action:'rest',taken,rest_date}));}catch(e){setError(e.message);}finally{setBusy(false);}}
 const programme=data?.programme,days=data?.days||[],extras=data?.extras||[],statuses=data?.statuses||{},sessions=data?.sessions||[];
 const completed=days.filter(d=>statuses[d.id]?.complete).length;
 const trainingDates=new Set(sessions.map(s=>s.day));
 const isLoaded=data?.week_start===week;
 return <TabShell active="workout" title="Your training.">
  <div className="training-intro"><p>Your programme, your pace. Make every session count.</p><TrainingMenu/></div>
  <nav className="workout-week-nav" aria-label="Training week"><button className="btn btn-ghost" aria-label="Previous week" disabled={busy||!data?.first_week||week<=data.first_week} onClick={()=>setWeek(addDays(week,-7))}>←</button><div><strong>{past?'Previous week':'This week'}</strong><span>{dateLabel(week)} – {dateLabel(addDays(week,6))}</span></div><button className="btn btn-ghost" aria-label="Next week" disabled={busy||week>=current} onClick={()=>setWeek(addDays(week,7))}>→</button>{past&&<button className="btn btn-secondary" disabled={busy} onClick={()=>setWeek(current)}>This week</button>}</nav>
  {error&&<p className="inline-error" role="alert">{error} <button className="btn btn-ghost" onClick={()=>setRetry(n=>n+1)}>Try again</button>{!isLoaded&&readView(profile?.id,'last-training-week')?.data?.week_start&&<Link className="btn btn-secondary" to={`/workout?week=${readView(profile.id,'last-training-week').data.week_start}`}>Open last saved week</Link>}</p>}
  {busy&&!isLoaded&&<div className="mf-card" role="status">Loading your training week…</div>}
  {data?.fromDevice&&<p className="mf-card" role="status">Showing your saved training week. Connect to refresh progress and start or resume a session.</p>}
  {isLoaded&&<>
   <div className="daystrip">{['M','T','W','T','F','S','S'].map((name,i)=>{const date=addDays(week,i),done=trainingDates.has(date),rested=data.rest_dates?.includes(date);return <div key={date} className={`day-pill ${date===today?'today':''} ${done?'week-calendar-done':rested?'week-calendar-rest':''}`} title={`${date}: ${done?'Workout completed':rested?'Rest taken':'Flexible schedule'}`}><span>{name}</span><span className="d">{Number(date.slice(-2))}</span><span className="day-dot">{done?'✓':rested?'R':''}</span></div>;})}</div>
   {programme?<>
    <div className="training-stats workout-week-stats"><div className="training-stat"><strong>{completed} / {days.length}</strong><span>Workouts completed</span></div><div className="training-stat"><strong>{data.rest_remaining}</strong><span>Rest days {past?'not recorded':'left'}</span></div><div className="training-stat"><strong>{data.rest_target}</strong><span>Rest days planned</span></div></div>
    {!past&&data.next_day&&!data.fromDevice&&<Link className="btn btn-primary workout-next-button" to={`/workout/day/${data.next_day}`}>Start next workout</Link>}
    {data.unfinished&&!past&&<section className="mf-card"><h3>Continue your workout</h3><p className="subtle">Your unfinished session is saved and paused.</p>{!data.fromDevice&&<Link className="btn btn-secondary" to={`/workout/session/${data.unfinished.day_id||'free'}?resume=${data.unfinished.id}`}>Return to session →</Link>}</section>}
    <div className="sec-label">Workouts · {past?'week in review':'this week'}</div>
    {!data.full_week&&<p className="subtle">Your programme started partway through this week. Unfinished workouts in this first partial week are not marked missed or carried forward.</p>}
    <div className="workout-week-list">{days.map(d=>{const list=(data.exercises||[]).filter(e=>e.day_id===d.id),status=statuses[d.id]||{},extra=extras.filter(e=>e.day_id===d.id);return <Link key={d.id} to={`/workout/day/${d.id}?week=${week}`} className={`mf-card workout-week-day is-${status.status||'planned'}`} aria-label={`${d.label||''} ${d.name}, ${status.complete?'completed':status.status==='missed'?'missed':'planned'}`}><span className="workout-week-icon">{status.complete?'✓':status.status==='missed'?'!':d.label||d.name[0]}</span><span className="workout-week-copy"><b>{d.label?`${d.label} · `:''}{d.name}</b><span className="subtle">{status.complete?`Completed · ${status.performed?.length||0}/${list.length} exercises performed`:status.status==='missed'?`Missed · ${list.length} exercises`:`${list.length} exercises · ${list.slice(0,2).map(e=>e.name).join(', ')}${list.length>2?'…':''}`}</span></span>{extra.length>0&&<span className="badge badge-neutral">+{extra.length} optional</span>}<span aria-hidden="true">›</span></Link>;})}</div>
    <section className="mf-card workout-rest-card"><div className="section-heading"><h2>Rest & recovery</h2><span className="badge badge-neutral">{data.rest_remaining} / {data.rest_target} {past?'not recorded':'left'}</span></div><p className="subtle">Rest days are flexible.</p><div className="workout-week-list">{Array.from({length:data.rest_target},(_,i)=>{const date=data.rest_dates[i];return <div key={i} className={`workout-rest-row ${date?'is-taken':''}`}><span>{date?'✓':'R'}</span><div><strong>Rest day {i+1}</strong><small>{date?`Taken ${dateLabel(date)}`:past?'Not recorded':'Available'}</small></div>{date&&!past&&<button className="btn btn-ghost" disabled={busy||!data.can_write} onClick={()=>rest(false,date)}>Undo</button>}</div>;})}</div>{!past&&data.rest_remaining>0&&<button className="btn btn-secondary" disabled={busy||!data.can_write||trainingDates.has(today)||data.rest_dates.includes(today)} onClick={()=>rest()}>Mark today as rest</button>}{!data.rest_target&&<p className="subtle">No rest days scheduled. Update your programme to add some.</p>}</section>
   </>:<div className="mf-card"><h3>No active programme yet</h3><p className="subtle">Build a programme around your goals, schedule and equipment.</p><Link className="btn btn-primary" to="/onboarding?new=1">Build my programme</Link></div>}
  </>}
 </TabShell>;
}

export default function WorkoutTab(){
 const {profile}=useAuth();const access=useMembership(profile?.id);
 if(access.premium)return <ProgrammeWorkoutTab/>;
 if(access.checking&&!access.member)return <TabShell active="workout" title="Your training."><p role="status">Opening your training…</p></TabShell>;
 return <TabShell active="workout" title="Your training."><div className="training-intro"><p>Your next session starts here.</p><TrainingMenu/></div><Link className="btn btn-primary workout-next-button" to="/workout/session/free">Start freestyle workout</Link><section className="mf-card"><h2>Keep building your progress</h2><p className="subtle">Log sets, weights and reps, use the rest timer and return to your saved records.</p><Link className="btn btn-secondary" to="/workout/stats">Exercise records →</Link><Link className="btn btn-ghost" to="/workout/history">Workout history →</Link></section><PremiumPaywall feature="personalised programmes"/></TabShell>;
}
