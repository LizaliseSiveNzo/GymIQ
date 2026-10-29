// Transparent product rules. Suggestions are reviewed before applying to unperformed sets.
export const coachKey=item=>item.exerciseId||`name:${String(item.name).trim().toLowerCase()}`;
const repsFor=s=>Math.min(Number(s.reps)||0,s.reps_left==null?Infinity:Number(s.reps_left)||0);
const weightFor=s=>Number(s.weight)||0;
export function progressionSuggestion({item,progress=[],feedback=[],readiness='ready',increment=null,now=Date.now()}){
 const lo=Number(item.scheme?.repMin)||8,hi=Number(item.scheme?.repMax)||12,count=Number(item.scheme?.sets)||3;
 const g=progress.find(p=>p.key===coachKey(item));
 const result=(kind,title,reason,weight=null,reps=null)=>({kind,title,reason,weight,reps,rowReps:Array(count).fill(reps),canApply:weight!==null&&reps!==null,signature:JSON.stringify([kind,weight,reps,g?.last?.id,readiness,increment])});
 if(!g?.sessions?.length)return result('start','Build your starting point','Choose a comfortable starting load and log your working sets. Recommendations use your own completed sessions.');
 const sessions=g.sessions,latest=sessions[0],sets=latest.sets.filter(s=>s.set_type!=='warmup'&&s.completed!==false&&repsFor(s)>0).slice(0,count);
 if(!sets.length)return result('start','Log a complete exercise first','There are no usable working sets for this exercise yet.');
 const weight=weightFor(sets[0]),minReps=Math.min(...sets.map(repsFor)),baseReps=Math.max(lo,Math.min(hi,minReps));
 if(!Number.isFinite(weight)||weight<0||!Number.isFinite(minReps))return result('review','Review your recorded values','The previous load or rep values need correction before a recommendation can be calculated.');
 const effort=s=>feedback.find(f=>f.log_id===s.id&&f.exercise_key===coachKey(item))?.effort;
 const comparable=s=>s.sets.filter(r=>r.set_type!=='warmup'&&r.completed!==false&&repsFor(r)>0).slice(0,count);
 if(readiness!=='ready')return result('hold','Keep today manageable',`${readiness==='sore'?'You marked yourself sore':'You marked yourself tired'}. No progression is suggested today. Review the load, range of motion and whether to rest; stop an exercise that causes pain.`,weight,Math.max(lo,Math.min(baseReps,hi)));
 if(item.optional)return result('hold','Keep make-up work easy','This is optional make-up work. No extra progression is added on top of it.',weight,baseReps);
 if(now-Date.parse(latest.date)>21*86400000)return result('hold','Re-establish your baseline','Your latest record is more than three weeks old. Repeat a manageable load before considering an increase.',weight,baseReps);
 if(sets.length<count)return result('hold','Finish the prescribed sets first',`Your last session has ${sets.length} of ${count} prescribed working sets. Keep the load steady until the full exercise is recorded.`,weight,baseReps);
 if(sets.some(s=>weightFor(s)!==weight||(s.reps_left!=null&&(Number(s.weight_left)||0)!==weight)))return result('review','Review your set-by-set loads','The last exercise used different loads between sets or sides. Keep your individual previous values and review them rather than applying one automatic load.');
 if(/assisted/i.test(item.name))return result('review','Review assistance manually','On assisted exercises, a higher machine weight can make the movement easier. Choose assistance manually; your previous sets stay available.');
 const step=Number(increment),validStep=Number.isFinite(step)&&step>=.1&&step<=100;
 if(effort(latest)==='hard'){
  if(weight>0&&validStep&&step/weight<=.1&&weight-step>0)return result('reduce','Consider one smaller load step','You rated the last session too hard. Review one smaller available increment and return to the lower end of the rep range.',Math.round((weight-step)*100)/100,lo);
  return result('review','Review the load before repeating','You rated the last session too hard. Consider a lighter load or more recovery. Enter your available weight increment to review a specific smaller step.');
 }
 if(!['easy','right'].includes(effort(latest)))return result('hold','Repeat, then rate the effort','Rate completed working sets as Too easy, About right or Too hard. That feedback helps avoid treating an unreviewed session as a reason to increase.',weight,baseReps);
 if(minReps<lo)return result('hold','Reach the lower end first','At least one working set was below your prescribed rep range. Keep the load manageable and review technique or recovery.',weight,lo);
 const prior=sessions[1],priorSets=prior?comparable(prior):[];
 const provenTop=minReps>=hi&&priorSets.length===count&&priorSets.every(s=>weightFor(s)===weight&&repsFor(s)>=hi&&(s.reps_left==null||(Number(s.weight_left)||0)===weight))&&['easy','right'].includes(effort(prior));
 if(provenTop&&weight>0){
  if(!validStep)return result('review','Ready to review a load increase','You reached the top of the rep range in two complete sessions with positive effort feedback. Enter the smallest available increase in the kg values you log.');
  if(step/weight>.1)return result('hold','Your available jump is too large','That increment exceeds this coach’s 10% increase limit. Keep the load, use a smaller available increment, or discuss another progression option.',weight,hi);
  if(weight+step>=10000)return result('review','Review this load manually','This load is outside the coach’s supported logging range.');
  return result('load','Try one small load increase','Two complete sessions reached the top of the rep range at this load with positive effort feedback. Review one available increment, then restart at the lower rep target.',Math.round((weight+step)*100)/100,lo);
 }
 if(minReps>=hi)return result('hold',weight===0?'Review a harder variation':'Confirm the top range once more',weight===0?'You reached the top range with bodyweight. Choose a suitable variation manually; the coach does not invent an added-weight prescription.':'Repeat this load at the top range. A load increase needs two complete sessions at the same load with positive effort feedback.',weight,hi);
 return {...result('reps','Try one more rep per set','Your last complete session was rated manageable. Keep the load and aim for one additional rep per working set, within the prescribed range.',weight,Math.min(hi,baseReps+1)),rowReps:sets.map(s=>Math.min(hi,Math.max(lo,repsFor(s)+1)))};
}
export function swapMatches(source,candidate,addedIds=[]){
 if(!source||!candidate||candidate.id===source.id||addedIds.includes(candidate.id))return false;
 return !!source.primary_muscle_id&&source.primary_muscle_id===candidate.primary_muscle_id&&!!source.movement_pattern&&source.movement_pattern===candidate.movement_pattern;
}
