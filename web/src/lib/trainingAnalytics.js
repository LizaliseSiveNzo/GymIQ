import {progressKey} from './exerciseProgress.js';
import {dayKey,addDays,weekStart} from '../../../supabase/functions/_shared/workoutWeek.js';
const normalized=name=>String(name||'').trim().toLowerCase();
export function analyticsStart(period,today=dayKey()){
 return period==='week'?weekStart(today):period==='month'?today.slice(0,7)+'-01':period==='4weeks'?addDays(today,-27):period==='12weeks'?addDays(today,-83):null;
}
function sides(row){
 const values=[{weight:row.weight==null?0:Number(row.weight),reps:Number(row.reps)||0}];
 if(row.reps_left!=null)values.push({weight:row.weight_left==null?0:Number(row.weight_left),reps:Number(row.reps_left)||0});
 return values.filter(s=>Number.isFinite(s.weight)&&s.weight>=0&&Number.isFinite(s.reps)&&s.reps>0);
}
export function buildTrainingAnalytics(rows=[],catalogue=[],muscles=[],{start=null,end=dayKey(),now=Date.now()}={}){
 const byId=new Map(catalogue.map(e=>[e.id,e])),byName=new Map();
 for(const e of catalogue){const name=normalized(e.name);byName.set(name,[...(byName.get(name)||[]),e]);}
 const groups=new Map(),parts=new Map(muscles.map(m=>[m.id,{id:m.id,name:m.name,primary:0,supporting:0}])),seen=new Set();
 let totalSets=0,unmapped=0;const logs=new Set(),rangeExercises=new Set();
 for(const row of rows){
  const timestamp=Date.parse(row.completed_at),paired=sides(row);
  if(!Number.isFinite(timestamp)||timestamp>now||row.cancelled_at||row.excluded||row.completed===false||row.set_type==='warmup'||!paired.length)continue;
  if(row.id&&seen.has(row.id))continue;if(row.id)seen.add(row.id);
  const date=dayKey(new Date(timestamp)),matches=byName.get(normalized(row.exercise_name))||[];
  // Never guess between ambiguous old exercise names.
  const meta=byId.get(row.exercise_id)||(matches.length===1?matches[0]:null);
  const key=progressKey(row),load=Math.min(...paired.map(s=>s.weight)),reps=Math.min(...paired.map(s=>s.reps));
  const inRange=(!start||date>=start)&&date<=end;
  if(inRange){
   totalSets++;logs.add(row.log_id);rangeExercises.add(key);
   const primary=meta?.primary_muscle_id;
   if(primary){if(!parts.has(primary))parts.set(primary,{id:primary,name:primary,primary:0,supporting:0});parts.get(primary).primary++;}
   else unmapped++;
   for(const [id,fraction] of Object.entries(meta?.secondary_muscle_fraction||{})){
    if(id===primary||!(Number(fraction)>0))continue;
    if(!parts.has(id))parts.set(id,{id,name:id,primary:0,supporting:0});parts.get(id).supporting++;
   }
  }
  let group=groups.get(key);
  if(!group){group={key,name:meta?.name||row.exercise_name||'Unnamed exercise',exerciseId:row.exercise_id,paired:false,points:new Map()};groups.set(key,group);}
  group.paired||=row.reps_left!=null;
  if(!inRange)continue;
  let point=group.points.get(row.log_id);
  if(!point){point={id:row.log_id,date:row.completed_at,day:date,load:-1,loadReps:0,bestReps:0,repsLoad:0,sets:0};group.points.set(row.log_id,point);}
  point.sets++;
  if(load>point.load||(load===point.load&&reps>point.loadReps)){point.load=load;point.loadReps=reps;}
  if(reps>point.bestReps||(reps===point.bestReps&&load>point.repsLoad)){point.bestReps=reps;point.repsLoad=load;}
 }
 return {totalSets,sessions:logs.size,exercisesLogged:rangeExercises.size,unmapped,
  bodyParts:[...parts.values()].sort((a,b)=>b.primary-a.primary||b.supporting-a.supporting||a.name.localeCompare(b.name)),
  exercises:[...groups.values()].map(g=>({...g,points:[...g.points.values()].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)||a.id.localeCompare(b.id))})).sort((a,b)=>a.name.localeCompare(b.name))};
}
export function chartScale(values){
 const maximum=Math.max(1,...values),rough=maximum/4,power=10**Math.floor(Math.log10(rough)),n=rough/power;
 const step=(n<=1?1:n<=2?2:n<=5?5:10)*power,max=Math.ceil(maximum/step)*step;
 return {max,ticks:Array.from({length:Math.round(max/step)+1},(_,i)=>Math.round(i*step*100)/100)};
}
