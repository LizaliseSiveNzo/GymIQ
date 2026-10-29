import {dayKey,addDays,weekStart} from '../../../supabase/functions/_shared/workoutWeek.js';
import {buildExerciseProgress} from './exerciseProgress.js';
export function storyMonth(value,today=dayKey()){
 return /^\d{4}-(0[1-9]|1[0-2])$/.test(value||'')&&value>='1900-01'&&value<=today.slice(0,7)?value:today.slice(0,7);
}
export function shiftMonth(month,amount){const date=new Date(`${month}-01T12:00:00Z`);date.setUTCMonth(date.getUTCMonth()+amount);return date.toISOString().slice(0,7);}
export function monthBounds(month,today=dayKey()){
 const start=`${month}-01`,fullEnd=addDays(`${shiftMonth(month,1)}-01`,-1);
 return {start,end:fullEnd<today?fullEnd:today,fullEnd,ongoing:month===today.slice(0,7)};
}
const average=values=>values.reduce((a,b)=>a+b,0)/values.length;
const rounded=value=>Math.round(value*10)/10;
function setValue(set){
 const sides=[{weight:Number(set.weight)||0,reps:Number(set.reps)||0}];
 if(set.reps_left!=null)sides.push({weight:Number(set.weight_left)||0,reps:Number(set.reps_left)||0});
 if(sides.some(s=>!Number.isFinite(s.weight)||s.weight<0||!Number.isFinite(s.reps)||s.reps<=0))return null;
 return {weight:Math.min(...sides.map(s=>s.weight)),reps:Math.min(...sides.map(s=>s.reps))};
}
export function buildProgressStory({rows=[],weights=[],food=[],month,today=dayKey(),now=Date.now()}){
 const range=monthBounds(month,today),seen=new Set();
 const valid=buildExerciseProgress(rows.filter(r=>{const timestamp=Date.parse(r.completed_at);if(!Number.isFinite(timestamp)||timestamp>now||r.id&&seen.has(r.id))return false;if(r.id)seen.add(r.id);return true;})).flatMap(g=>g.sets).filter(s=>setValue(s));
 const selected=valid.filter(s=>{const d=dayKey(new Date(s.completed_at));return d>=range.start&&d<=range.end;});
 const sessions=new Map(),calendar=new Map(),weeks=new Map();
 for(const s of selected){const date=dayKey(new Date(s.completed_at));sessions.set(s.log_id,date);}
 for(const [id,date] of sessions){calendar.set(date,(calendar.get(date)||0)+1);const week=weekStart(date);if(!weeks.has(week))weeks.set(week,new Set());weeks.get(week).add(id);}
 const weekKeys=[...weeks.keys()].sort();let run=0,longestRun=0,previous=null;
 for(const key of weekKeys){run=previous&&addDays(previous,7)===key?run+1:1;longestRun=Math.max(longestRun,run);previous=key;}
 const lifts=buildExerciseProgress(selected).map(g=>{
  const first=g.sessions[g.sessions.length-1],last=g.sessions[0],before=first.sets.map(setValue).filter(Boolean),after=last.sets.map(setValue).filter(Boolean);
  const top=values=>[...values].sort((a,b)=>b.weight-a.weight||b.reps-a.reps)[0];
  const assisted=/assisted/i.test(g.name),sameSession=first.id===last.id;
  const common=[...new Set(before.map(s=>s.reps))].filter(reps=>after.some(s=>s.reps===reps)).sort((a,b)=>b-a);
  const bodyweight=before.every(s=>s.weight===0)&&after.every(s=>s.weight===0);
  let baseline=top(before),latest=top(after),delta=null,metric='kg';
  if(!sameSession&&!assisted){
   if(bodyweight){baseline=[...before].sort((a,b)=>b.reps-a.reps)[0];latest=[...after].sort((a,b)=>b.reps-a.reps)[0];delta=latest.reps-baseline.reps;metric='reps';}
   else if(common.length){baseline=top(before.filter(s=>s.reps===common[0]));latest=top(after.filter(s=>s.reps===common[0]));delta=rounded(latest.weight-baseline.weight);}
  }
  return {key:g.key,name:g.name,sessions:g.sessions.length,baseline,latest,firstDate:dayKey(new Date(first.date)),lastDate:dayKey(new Date(last.date)),delta,metric,assisted};
 }).sort((a,b)=>a.name.localeCompare(b.name));
 const scale=weights.filter(w=>w.metric_date>=range.start&&w.metric_date<=range.end&&Number.isFinite(Number(w.weight_kg))&&Number(w.weight_kg)>=35&&Number(w.weight_kg)<=300).sort((a,b)=>a.metric_date.localeCompare(b.metric_date));
 const scaleWeeks=new Map();for(const w of scale){const key=weekStart(w.metric_date);if(!scaleWeeks.has(key))scaleWeeks.set(key,[]);scaleWeeks.get(key).push(Number(w.weight_kg));}
 const averages=[...scaleWeeks].map(([week,values])=>({week,count:values.length,value:rounded(average(values))}));
 const firstAverage=averages[0],lastAverage=averages[averages.length-1];
 const weightChange=averages.length>=2&&firstAverage.count>=2&&lastAverage.count>=2?rounded(lastAverage.value-firstAverage.value):null;
 const foodDays=food.filter(d=>d.day>=range.start&&d.day<=range.end),completeFood=foodDays.filter(d=>d.complete===true).length;
 const days=Array.from({length:Number(range.fullEnd.slice(-2))},(_,i)=>{const date=addDays(range.start,i);return {date,sessions:calendar.get(date)||0,future:date>range.end};});
 const improvements=lifts.filter(l=>l.delta>0),prior=valid.some(s=>dayKey(new Date(s.completed_at))<range.start);
 const firstWorkout=!prior&&sessions.size?[...sessions.values()].sort()[0]:null;
 return {...range,month,sets:selected.length,sessions:sessions.size,trainingDays:calendar.size,trainingWeeks:weeks.size,longestRun,days,lifts,improvements,firstWorkout,scale,weightChange,firstAverage,lastAverage,completeFood,elapsedDays:Number(range.end.slice(-2))};
}
