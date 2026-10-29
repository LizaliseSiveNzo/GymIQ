import {createClient} from 'npm:@supabase/supabase-js@2.45.0';
import {admin,authenticate,json} from '../_shared/launch.ts';
import {weekStart,addDays,makeUpExercises,dayProgress} from '../_shared/workoutWeek.js';
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return json({});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const user=await authenticate(req);if(!user)return json({error:'Sign in to view your training week.'},401);
 try{
  const raw=await req.text();if(raw.length>2048)return json({error:'Request too large'},400);
  const body=JSON.parse(raw),offset=body.offset;
  if(!Number.isInteger(offset)||Math.abs(offset)>840||!['week','rest'].includes(body.action||'week'))return json({error:'Invalid week request'},400);
  const today=new Date(Date.now()-offset*60000).toISOString().slice(0,10),current=weekStart(today);
  const week=body.week||current;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(week)||weekStart(week)!==week||week>current)return json({error:'Choose a valid past or current Monday.'},400);
  const scoped=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:req.headers.get('Authorization')!}},auth:{persistSession:false}});
  let query=scoped.from('workout_programmes').select('*').eq('client_id',user.id);
  query=body.programme_id?query.eq('id',body.programme_id):query.eq('is_active',true);
  const p=await query.order('created_at',{ascending:false}).limit(1);
  if(p.error)throw Error('Programme unavailable');
  const programme=p.data?.[0];if(!programme)return json({programme:null,current_week:current,week_start:week});
  const createdDay=new Date(Date.parse(programme.created_at)-offset*60000).toISOString().slice(0,10),first=weekStart(createdDay);
  if(week<first)return json({error:'This programme had not started in that week.'},400);
  const daysResult=await scoped.from('programme_days').select('id,label,name,sort_order').eq('programme_id',programme.id).eq('client_id',user.id).order('sort_order');
  if(daysResult.error)throw Error('Days unavailable');
  const days=daysResult.data||[],ids=days.map(d=>d.id);
  const [base,activity,unfinished,saved,rest]=await Promise.all([
   ids.length?scoped.from('programme_exercises').select('id,day_id,exercise_id,name,target_sets,target_reps,target_rir,rest_seconds,sort_order,exercises(primary_muscle_id,secondary_muscle_fraction,laterality,equipment_ids)').eq('client_id',user.id).in('day_id',ids).order('sort_order'):Promise.resolve({data:[],error:null}),
   scoped.rpc('workout_week_activity',{p_from:addDays(week,-7),p_to:addDays(week,6),p_offset:offset}),
   scoped.from('workout_logs').select('id,day_id').eq('client_id',user.id).is('completed_at',null).is('cancelled_at',null).order('created_at',{ascending:false}),
   scoped.from('workout_week_plans').select('extras').eq('user_id',user.id).eq('programme_id',programme.id).eq('week_start',week).maybeSingle(),
   scoped.from('workout_rest_days').select('rest_date').eq('user_id',user.id).eq('programme_id',programme.id).gte('rest_date',week).lte('rest_date',addDays(week,6)),
  ]);
  if([base,activity,unfinished,saved,rest].some(r=>r.error))throw Error('Week unavailable');
  const exercises=base.data||[],sessions=(activity.data||[]).filter((s:any)=>s.day>=week),previous=(activity.data||[]).filter((s:any)=>s.day<week);
  const fullWeek=week>first||createdDay===week;
  const member=await scoped.rpc('has_active_membership');
  const canWrite=!member.error&&member.data===true&&programme.is_active===true;
  const db=admin();let extras=saved.data?.extras||[];
  if(week===current&&!saved.data&&canWrite){
   const sourceWeek=addDays(week,-7);
   extras=sourceWeek>=createdDay?makeUpExercises(days,exercises,previous,sessions,(unfinished.data||[]).map(l=>l.day_id),sourceWeek):[];
   const insert=await db.from('workout_week_plans').upsert({user_id:user.id,programme_id:programme.id,week_start:week,extras},{onConflict:'user_id,programme_id,week_start',ignoreDuplicates:true});
   if(insert.error)throw Error('Week preparation failed');
   const stable=await scoped.from('workout_week_plans').select('extras').eq('user_id',user.id).eq('programme_id',programme.id).eq('week_start',week).single();
   if(stable.error)throw Error('Week preparation failed');extras=stable.data.extras;
  }
  const restTarget=Math.max(0,7-days.length),activeDays=new Set(sessions.map((s:any)=>s.day));
  let restDates=(rest.data||[]).map(r=>r.rest_date).filter(d=>!activeDays.has(d));
  if(body.action==='rest'){
   if(!canWrite||week!==current)return json({error:'Rest-day changes require your active programme and current week.'},403);
   if(body.taken===false){
    if(!restDates.includes(body.rest_date))return json({error:'Rest day not found.'},400);
    const deleted=await db.from('workout_rest_days').delete().eq('user_id',user.id).eq('programme_id',programme.id).eq('rest_date',body.rest_date);
    if(deleted.error)throw Error('Rest update failed');restDates=restDates.filter(d=>d!==body.rest_date);
   }else{
    if(activeDays.has(today))return json({error:'A finished workout is already recorded today. Choose a rest day without a workout.'},400);
    if(restDates.length>=restTarget||restDates.includes(today))return json({error:'Your planned rest days are already accounted for.'},400);
    const inserted=await db.from('workout_rest_days').upsert({user_id:user.id,programme_id:programme.id,rest_date:today},{onConflict:'user_id,programme_id,rest_date'});
    if(inserted.error)throw Error('Rest update failed');restDates.push(today);
   }
  }
  const statuses=Object.fromEntries(days.map(d=>[d.id,dayProgress(d,exercises.filter(e=>e.day_id===d.id),sessions,week<current&&fullWeek)]));
  const next=days.find(d=>!statuses[d.id].complete)||days[0];
  return json({programme,days,exercises,extras,statuses,sessions,rest_dates:restDates,rest_target:restTarget,rest_remaining:Math.max(0,restTarget-restDates.length),week_start:week,current_week:current,first_week:first,full_week:fullWeek,can_write:canWrite,next_day:next?.id||null,unfinished:(unfinished.data||[]).find(l=>!l.day_id||ids.includes(l.day_id))||null});
 }catch{return json({error:'Your training week could not load. Please try again.'},500);}
});
