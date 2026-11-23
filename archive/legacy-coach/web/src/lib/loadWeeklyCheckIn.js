import {supabase} from './supabaseClient.js';
import {loadExerciseProgress} from './loadExerciseProgress.js';
import {addDays} from '../../../supabase/functions/_shared/workoutWeek.js';

export async function loadWeeklyCheckIn(userId,week,isCancelled=()=>false){
 const end=addDays(week,6),prior=addDays(week,-7),offset=new Date().getTimezoneOffset();
 const results=await Promise.all([
  loadExerciseProgress(isCancelled),
  supabase.rpc('workout_week_activity',{p_from:prior,p_to:end,p_offset:offset}),
  supabase.rpc('nutrition_period',{p_day:end,p_offset:offset}),
  supabase.from('body_metrics').select('metric_date,weight_kg').eq('client_id',userId).gte('metric_date',prior).lte('metric_date',end).order('metric_date'),
  supabase.from('workout_programmes').select('id,name,created_at,is_active').eq('client_id',userId).eq('is_active',true).order('created_at',{ascending:false}).limit(1),
  supabase.from('exercise_coach_feedback').select('log_id,exercise_key,effort').eq('user_id',userId).gte('updated_at',new Date(Date.now()-42*86400000).toISOString()).limit(1000),
  supabase.from('exercise_coach_preferences').select('exercise_key,load_increment').eq('user_id',userId),
  supabase.from('exercise_targets').select('*').eq('user_id',userId),
 ]);
 if(results.slice(1).some(r=>r.error))throw Error('Your weekly records could not load. Please try again.');
 const [progress,activity,food,weights,programmes,feedback,preferences,targets]=results;
 const programme=programmes.data?.[0]||null;
 let days=[],exercises=[];
 if(programme){
  const result=await supabase.from('programme_days').select('id,name').eq('client_id',userId).eq('programme_id',programme.id);
  if(result.error)throw result.error;days=result.data||[];
  if(days.length){const result=await supabase.from('programme_exercises').select('id,name,exercise_id,target_sets,target_reps,rep_min,rep_max').eq('client_id',userId).in('day_id',days.map(d=>d.id)).order('sort_order');if(result.error)throw result.error;exercises=result.data||[];}
 }
 return {userId,week,progress,rows:progress.flatMap(g=>g.sets),sessions:activity.data||[],food:food.data||[],weights:weights.data||[],programme,days,exercises:programme?.is_active?exercises:[],feedback:feedback.data||[],preferences:preferences.data||[],targets:targets.data||[]};
}
