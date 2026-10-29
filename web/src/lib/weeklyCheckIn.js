import {addDays, dayKey, weekStart} from '../../../supabase/functions/_shared/workoutWeek.js';
import {buildExerciseProgress} from './exerciseProgress.js';
import {progressionSuggestion, coachKey} from './progressionCoach.js';

const mean=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
const round=value=>value==null?null:Math.round(value*10)/10;
export function reviewWeek(value,today=dayKey()){
 const latest=addDays(weekStart(today),-7);
 return /^\d{4}-\d{2}-\d{2}$/.test(value||'')&&Number.isFinite(Date.parse(value))&&weekStart(value)===value&&value<=latest?value:latest;
}
// All dates represent the user's local calendar; missing food days are unknown.
export function buildWeeklyCheckIn({week,rows=[],sessions=[],days=[],programme=null,weights=[],food=[]}){
 const end=addDays(week,6),prior=addDays(week,-7);
 const seenRows=new Set();
 const valid=buildExerciseProgress(rows.filter(r=>{const timestamp=Date.parse(r.completed_at);if(!Number.isFinite(timestamp)||timestamp>Date.now()||r.id&&seenRows.has(r.id))return false;if(r.id)seenRows.add(r.id);return true;})).flatMap(g=>g.sets);
 const inWeek=day=>day>=week&&day<=end;
 const dated=valid.map(row=>({...row,localDay:dayKey(new Date(row.completed_at))}));
 const current=dated.filter(row=>inWeek(row.localDay)),previous=dated.filter(row=>row.localDay>=prior&&row.localDay<week);
 const finished=sessions.filter(s=>inWeek(s.day)),done=new Set(finished.map(s=>s.day_id).filter(Boolean));
 const fullProgramme=programme&&dayKey(new Date(programme.created_at))<=week;
 const completeDays=days.filter(d=>done.has(d.id)).length;
 const strength=buildExerciseProgress([...current,...previous]).map(g=>{
  // Compare the latest session in each week. Lower-side values keep paired sets comparable.
  const point=session=>{
   if(!session)return null;
   return session.sets.map(s=>({weight:s.reps_left==null?Number(s.weight)||0:Math.min(Number(s.weight)||0,Number(s.weight_left)||0),reps:s.reps_left==null?Number(s.reps)||0:Math.min(Number(s.reps)||0,Number(s.reps_left)||0)})).filter(s=>s.reps>0).sort((a,b)=>b.weight-a.weight||b.reps-a.reps)[0]||null;
  };
  const latest=point(g.sessions.find(s=>inWeek(dayKey(new Date(s.date)))));
  const before=point(g.sessions.find(s=>{const d=dayKey(new Date(s.date));return d>=prior&&d<week;}));
  return {key:g.key,name:g.name,latest,before,change:latest&&before?round(latest.weight-before.weight):null};
 }).filter(g=>g.latest).sort((a,b)=>a.name.localeCompare(b.name));
 const weekWeights=weights.filter(w=>inWeek(w.metric_date)&&Number(w.weight_kg)>0);
 const previousWeights=weights.filter(w=>w.metric_date>=prior&&w.metric_date<week&&Number(w.weight_kg)>0);
 const weightMean=mean(weekWeights.map(w=>Number(w.weight_kg))),previousMean=mean(previousWeights.map(w=>Number(w.weight_kg)));
 const weightChange=weekWeights.length>=2&&previousWeights.length>=2?round(weightMean-previousMean):null;
 const foodDays=Array.from({length:7},(_,i)=>{
  const day=addDays(week,i),row=food.find(f=>f.day===day);
  return {day,kcal:Math.max(0,Number(row?.kcal)||0),complete:row?.complete===true,entries:Number(row?.entries)||0,target:Number(row?.target)>0?Number(row.target):null};
 });
 const complete=foodDays.filter(d=>d.complete),comparable=complete.filter(d=>d.target!=null);
 const priorities=[];
 if(!current.length)priorities.push('Start with one manageable workout and log the working sets you actually finish.');
 else if(fullProgramme&&completeDays<days.length)priorities.push('Choose realistic training days for the coming week. Use the optional make-up work only if recovery allows.');
 else priorities.push('Keep a repeatable schedule. Review the next-session targets below before increasing a load.');
 if(complete.length<7)priorities.push(`Finish logging ${7-complete.length} unconfirmed food ${7-complete.length===1?'day':'days'} where you can. Missing records cannot tell us your calorie deficit.`);
 else priorities.push('Keep logging portions and extras. Compare complete days with their dated calorie guides; return to your usual plan after an unplanned meal.');
 if(weightChange==null)priorities.push('For a clearer weight trend, record at least two weigh-ins in each week under similar conditions.');
 return {week,end,sets:current.length,previousSets:previous.length,sessions:new Set(current.map(r=>r.log_id)).size,completeDays,plannedDays:fullProgramme?days.length:null,programmeName:programme?.name||null,strength,weight:{count:weekWeights.length,previousCount:previousWeights.length,average:round(weightMean),previousAverage:round(previousMean),change:weightChange},nutrition:{days:foodDays,complete:complete.length,comparable:comparable.length,average:round(mean(complete.map(d=>d.kcal))),targetAverage:round(mean(comparable.map(d=>d.target))),difference:round(mean(comparable.map(d=>d.kcal-d.target)))},priorities};
}

export function weeklyTargetSuggestions({exercises=[],progress=[],feedback=[],preferences=[],now=Date.now()}){
 const seen=new Set(),suggestions=[];
 for(const e of exercises){
  const range=String(e.target_reps||'8-12').split('-').map(Number);
  const item={exerciseId:e.exercise_id,name:e.name,scheme:{sets:e.target_sets,repMin:e.rep_min||range[0],repMax:e.rep_max||range[1]||range[0]}};
  const key=coachKey(item);if(seen.has(key))continue;seen.add(key);
  const suggestion=progressionSuggestion({item,progress,feedback,increment:preferences.find(p=>p.exercise_key===key)?.load_increment,now});
  // Persistent targets have one rep value. Keep varying per-set advice in the session coach.
  if(suggestion.canApply&&['reps','load','reduce'].includes(suggestion.kind)&&new Set(suggestion.rowReps).size===1)suggestions.push({...item,key,suggestion});
 }
 return suggestions.slice(0,6);
}
