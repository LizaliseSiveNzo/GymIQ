import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {buildPlan,eligibleRecipes,mealTotals,SLOTS} from '../../supabase/functions/_shared/nutrition/planner.js';
import {addDays,weekStart,makeUpExercises} from '../../supabase/functions/_shared/workoutWeek.js';
export const TAG='GYMIQ_MOCK_90D_20261103';
export const seedId=value=>{const h=createHash('md5').update(TAG+':'+value).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;};
const localDay=iso=>new Date(Date.parse(iso)+120*60000).toISOString().slice(0,10);
const time=(day,hour=17,minute=0)=>new Date(`${day}T${String(hour-2).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00Z`).toISOString();
const round=(n,step=1)=>Math.round(n/step)*step;
const bases=[20,40,25,60,0,20,25,25,0,12,35,0,50,18,35,12,10,5,100,0,35,40,0,5,18,14,0,10,0,0];
const gains=[8,12.5,10,25,0,7.5,10,7.5,0,6,12.5,0,20,8,12.5,6,4,3,40,0,12.5,20,0,2.5,8,6,0,6,0,0];
export function generateAgedData(before,foods,{start='2026-08-03',end='2026-11-02'}={}){
 if(before.account?.email?.toLowerCase()!=='lizalisenzo@gmail.com')throw Error('This fixture is restricted to the requested Lizalise Nzo account.');
 const programme=before.programmes.find(p=>p.is_active),days=before.days.filter(d=>d.programme_id===programme?.id).sort((a,b)=>a.sort_order-b.sort_order);
 if(!programme||days.length!==5)throw Error('Expected the existing five-day programme. Nothing has been changed.');
 const exercises=days.flatMap(d=>before.exercises.filter(e=>e.day_id===d.id).sort((a,b)=>a.sort_order-b.sort_order));
 if(exercises.length!==30)throw Error('Review exercise load mappings for this programme first.');
 const originalWorkoutDays=new Set(before.logs.map(l=>localDay(l.created_at)));
 const originalFoodDays=new Set([...before.food.filter(f=>f.kind==='food').map(f=>f.log_day||localDay(f.occurred_at)),...before.dayStatus.map(s=>s.day)]);
 const originalWeights=new Set(before.weights.map(w=>w.metric_date));
 const choices=eligibleRecipes(foods,before.goal?.settings?.diet||'regular',before.goal?.settings?.excludes||[]);
 const menus=[];for(const target of [2400,2350,2300,2250])for(let variant=0;variant<6;variant++){
  const selection=Object.fromEntries(SLOTS.map((slot,i)=>{const options=choices.filter(r=>r.slot===slot);return [slot,options[(variant*3+i)%options.length].id];}));
  menus.push({target,meals:buildPlan(target,foods,before.goal?.settings?.diet||'regular',before.goal?.settings?.excludes||[],selection)});
 }
 const workouts=[],foodDays=[],weights=[],rest=[],missed=[],versions=[];
 const schedule=[0,1,null,2,3,4,null],misses=new Set(['1:1','3:4','5:3','8:2','8:4','10:1','12:4']);
 const programmeStart=localDay(programme.created_at);let n=0;
 for(let day=start;day<=end;day=addDays(day,1),n++){
  const week=Math.floor(n/7),dow=n%7,slot=schedule[dow],deload=week===6;
  if(slot!==null&&!originalWorkoutDays.has(day)){
   const cancelled=['3:4','8:2'].includes(`${week}:${slot}`),missing=misses.has(`${week}:${slot}`);
   if(missing&&!cancelled)missed.push({day,label:days[slot].label});
   else{
    const d=days[slot],planned=day>=programmeStart;
    const short=[19,52,74].includes(n),duration=cancelled?720:Math.round((deload?48:short?47:60+(n%5)*3.4)*60);
    const list=exercises.filter(e=>e.day_id===d.id).map(e=>{
     const index=exercises.indexOf(e),[lo,hi]=String(e.target_reps||'8-12').split('-').map(Number),isBody=bases[index]===0,step=/Dumbbell|Goblet|Step-Up/.test(e.name)?2:/Cable/.test(e.name)?2.5:2.5;
     const progress=week===5?4:week,stage=Math.floor(progress/3)/4;
     let kg=isBody?0:round(bases[index]+gains[index]*stage,step);if(deload)kg=round(kg*.85,step);
     const count=deload?2:3,repBase=isBody?Math.min((hi||lo)+3,lo+Math.floor(week/3)):Math.min(hi||lo,lo+1+(progress%3));
     return {id:e.exercise_id,pe:planned?e.id:null,name:e.name,kg,unilateral:e.exercises?.laterality==='unilateral',warmup:!isBody&&e.sort_order<2,
      reps:Array.from({length:count},(_,i)=>Math.max(lo,repBase-(i===2?1:0)-(n%17===0?1:0))),rir:deload?4:n%17===0?1:2,lo,hi:hi||lo};
    });
    const selected=cancelled?list.slice(0,1):short?list.slice(0,5):list;
    const readiness=deload?'tired':n%17===0?'tired':n%23===0?'sore':'ready';
    workouts.push({id:seedId('workout:'+day),day,day_id:planned?d.id:null,label:d.label,cancelled,short,deload,duration,readiness,created_at:time(day,17,10+n%25),exercises:selected});
    if(cancelled)missed.push({day,label:d.label,cancelled:true});
   }
  }else if(slot===null&&day>=programmeStart&&!originalWorkoutDays.has(day)&&!before.rest.some(r=>r.rest_date===day))rest.push(day);
  if(!originalFoodDays.has(day)&&![11,26,46,61,76,83].includes(n)){
   const tier=day<'2026-08-31'?0:day<'2026-09-28'?1:day<'2026-10-26'?2:3,menu=tier*6+(n%6),partial=n%10===4||n%13===7;
   const portions=[.95,1,1.05,1,1.1,1,1.02];
   const intake=menus[menu].meals.map((m,i)=>({slot:m.slot,name:m.name,items:m.items.map(item=>({...item,grams:Math.max(1,Math.round(item.grams*portions[(n+i)%7]))})),hour:[7,13,16,19][i]})).filter((_,i)=>!partial||i<2+(n%2));
   for(const meal of intake)meal.kcal=mealTotals(meal.items,foods).kcal;
   if(!partial&&n%9===0)intake.push({slot:'snack',name:'Unplanned coffee & biscuit',kcal:185+n%3*35,items:null,hour:15});
   if(!partial&&dow===5&&n%2===0)intake.push({slot:'snack',name:'Extra weekend snack',kcal:260,items:null,hour:21});
   foodDays.push({day,menu,complete:!partial,intake});
  }
  if([0,2,5].includes(dow)&&!originalWeights.has(day)){
   const kg=Math.round((84.5-3.9*n/91+.24*Math.sin(n*.77)+.12*Math.cos(n*.31))*10)/10;
   weights.push({id:seedId('weight:'+day),day,kg});
  }
 }
 for(const [day,target] of [['2026-08-03',2400],['2026-08-31',2350],['2026-09-28',2300],['2026-10-26',2250]])if(!before.versions.some(v=>v.effective_day===day))versions.push({day,result:{...before.goal.result,target,maintenance:target+300,monthly_loss_kg:1.17,requested_loss_kg:1.5}});
 const activity=[...before.logs.filter(w=>w.completed_at&&!w.cancelled_at).map(w=>({id:w.id,day_id:w.day_id,day:localDay(w.completed_at),sets:before.sets.filter(s=>s.log_id===w.id&&s.completed&&s.set_type!=='warmup'&&(s.reps>0||s.reps_left>0)&&!(w.excluded_exercises||[]).includes(s.programme_exercise_id?`pe_${s.programme_exercise_id}`:`nm_${s.exercise_name}`)).map(s=>({exercise_id:s.exercise_id,name:s.exercise_name,programme_exercise_id:s.programme_exercise_id}))})),...workouts.filter(w=>!w.cancelled).map(w=>({id:w.id,day_id:w.day_id,day:w.day,sets:w.exercises.map(e=>({exercise_id:e.id,name:e.name,programme_exercise_id:e.pe}))}))];
 const currentWeek=weekStart(addDays(end,1)),weeklyPlans=[];
 for(let week=weekStart(programmeStart);week<=currentWeek;week=addDays(week,7)){
  const source=addDays(week,-7),previous=activity.filter(w=>w.day>=source&&w.day<week),current=activity.filter(w=>w.day>=week&&w.day<=addDays(week,6));
  const blocked=week===currentWeek?before.logs.filter(w=>!w.completed_at&&!w.cancelled_at).map(w=>w.day_id):[];
  weeklyPlans.push({week,extras:source>=programmeStart?makeUpExercises(days,exercises,previous,current,blocked,source):[]});
 }
 return {tag:TAG,user_id:before.account.id,email:before.account.email,start,end,programme_id:programme.id,programme_start:programmeStart,menus,workouts,foodDays,weights,rest,versions,missed,weeklyPlans,exercise_names:[...new Set(exercises.map(e=>e.name))]};
}
const main=async()=>{
 const before=JSON.parse(await readFile(process.argv[2]||'artifacts/aged-account/before.json','utf8'));
 const foods=JSON.parse(await readFile(new URL('../../supabase/functions/_shared/nutrition/foods.json',import.meta.url),'utf8'));
 const data=generateAgedData(before,foods);await mkdir('artifacts/aged-account',{recursive:true});
 await writeFile('artifacts/aged-account/data.json',JSON.stringify(data));
 const template=await readFile(new URL('./aged-account-template.sql',import.meta.url),'utf8');
 const payload=JSON.stringify(data);if(payload.includes('$aged_fixture$'))throw Error('Invalid fixture delimiter');
 const sql=template.replace('__PAYLOAD__',payload);
 await writeFile('artifacts/aged-account/dry-run.sql',sql.replace('__FINISH__','rollback;'));
 await writeFile('artifacts/aged-account/apply.sql',sql.replace('__FINISH__','commit;'));
 const summary={tag:TAG,range:[data.start,data.end],finished:data.workouts.filter(w=>!w.cancelled).length,cancelled:data.workouts.filter(w=>w.cancelled).length,missed:data.missed.length,foodDays:data.foodDays.length,completeFoodDays:data.foodDays.filter(d=>d.complete).length,foodEntries:data.foodDays.reduce((n,d)=>n+d.intake.length,0),weighIns:data.weights.length,restDays:data.rest.length,sqlBytes:Buffer.byteLength(sql)};
 await writeFile('artifacts/aged-account/summary.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
};
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])await main();
