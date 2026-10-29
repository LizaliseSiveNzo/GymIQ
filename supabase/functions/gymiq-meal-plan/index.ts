import { createClient } from 'npm:@supabase/supabase-js@2.45.0';
import { admin, authenticate, json } from '../_shared/launch.ts';
import foods from '../_shared/nutrition/foods.json' with { type: 'json' };
import { SLOTS, RECIPES, calorieGuide, buildPlan, shufflePlan } from '../_shared/nutrition/planner.js';

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return json({});
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  const user=await authenticate(req);
  if(!user)return json({error:'Sign in to use your meal planner.'},401);
  try{
    const raw=await req.text();
    if(raw.length>6000)return json({error:'Request too large'},400);
    const body=JSON.parse(raw);
    if(!Number.isInteger(body.offset)||Math.abs(body.offset)>840)return json({error:'Invalid time zone'},400);
    const today=new Date(Date.now()-body.offset*60000).toISOString().slice(0,10);
    const scoped=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:req.headers.get('Authorization')!}},auth:{persistSession:false}});
    const membership=await scoped.rpc('has_active_membership');
    if(membership.error||membership.data!==true)return json({error:'Active membership is required.'},403);
    const db=admin();
    if(body.action==='goal'){
      const s=body.settings||{};
      if(!['planned','recorded'].includes(s.gym_basis)||!['regular','vegetarian','vegan'].includes(s.diet)||!Array.isArray(s.excludes)||s.excludes.some((a:string)=>!['milk','egg','fish','wheat','gluten','soy','nuts'].includes(a)))return json({error:'Check your meal preferences.'},400);
      let recorded=0;
      if(s.gym_basis==='recorded'){
        const logs=await scoped.rpc('nutrition_activity');
        if(logs.error)throw Error('Could not read workouts');
        if(logs.data?.sessions<3||Date.parse(logs.data?.oldest)>Date.now()-14*86400000||!logs.data?.oldest)return json({error:'Recorded activity needs at least 3 finished sessions spanning 14 days. Use a planned schedule for now.'},400);
        recorded=Number(logs.data.minutes_per_week);
      }
      let result;
      try{result=calorieGuide(s,recorded);}catch(e){return json({error:(e as Error).message},400);}
      const settings=Object.fromEntries(['sex','age','height_cm','weight_kg','goal_weight_kg','monthly_loss_kg','activity_level','gym_days','gym_minutes','gym_basis','diet','excludes','general_plan'].map(k=>[k,s[k]]));
      const saved=await db.rpc('save_nutrition_goal',{p_user:user.id,p_day:today,p_settings:settings,p_result:result});
      if(saved.error)throw Error('Goal save failed');
      return json({result,settings});
    }
    if(!['plan','shuffle'].includes(body.action))return json({error:'Invalid action'},400);
    const goal=await scoped.from('nutrition_goals').select('settings,result').eq('user_id',user.id).single();
    if(goal.error||!goal.data)return json({error:'Save your monthly goal first.'},400);
    const {settings,result}=goal.data;
    if(body.action==='shuffle'){
      const slot=body.slot||'all';
      if(slot!=='all'&&!SLOTS.includes(slot))return json({error:'Choose a valid meal to shuffle.'},400);
      const previous=await scoped.from('nutrition_meal_plans').select('*').eq('user_id',user.id).eq('day',today).single();
      if(previous.error||!previous.data)return json({error:'Build today’s plan before shuffling.'},400);
      if(previous.data.target!==result.target)return json({error:'Your calorie guide has changed. Rebuild today’s plan before shuffling.'},400);
      let plan;
      try{plan=shufflePlan(previous.data.plan,Number(result.target),foods,settings.diet,settings.excludes,slot);}catch(e){return json({error:(e as Error).message},400);}
      // Compare-and-swap avoids overwriting a plan changed in another tab/device.
      const saved=await db.from('nutrition_meal_plans').update({plan,source:'rules',created_at:new Date().toISOString()}).eq('user_id',user.id).eq('day',today).eq('created_at',previous.data.created_at).select('day').single();
      if(saved.error)return json({error:'Your plan changed elsewhere. Reload this page before shuffling again.'},409);
      return json({plan,source:'rules',target:result.target,reason:'shuffled'});
    }
    try{buildPlan(Number(result.target),foods,settings.diet,settings.excludes);}catch(e){return json({error:(e as Error).message},400);}
    let source='rules',reason='basic_selected',selection={};
    const model=Deno.env.get('GROQ_MODEL')?.trim()||'openai/gpt-oss-120b';
    const key=Deno.env.get('GROQ_API_KEY')?.trim();
    if(body.consent===true&&key&&['openai/gpt-oss-120b','openai/gpt-oss-20b'].includes(model)){
      // Public catalogue only: no target, measurements, preferences, logs or identifiers are sent.
      const facts={task:'public-meal-selection-v3-mixed-default',options:RECIPES.map(r=>({id:r.id,slot:r.slot,name:r.name}))};
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({model,...facts})));
      const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
      const valid=(v:any)=>v&&SLOTS.every((s:string)=>RECIPES.some(r=>r.slot===s&&r.id===v[s]));
      const cached=await db.from('ai_review_cache').select('review').eq('user_id',user.id).eq('review_domain','nutrition').eq('snapshot_hash',hash).maybeSingle();
      if(cached.error)reason='temporarily_unavailable';
      else if(valid(cached.data?.review)){selection=cached.data!.review;source='groq';reason='cached';}
      else{
        const reservation=await db.rpc('reserve_ai_review',{p_user:user.id,p_domain:'nutrition',p_hash:hash});
        reason=reservation.data?.status||'temporarily_unavailable';
        if(!reservation.error&&reason==='reserved')try{
          const properties=Object.fromEntries(SLOTS.map((s:string)=>[s,{type:'string',enum:RECIPES.filter(r=>r.slot===s).map(r=>r.id)}]));
          const response=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(18000),body:JSON.stringify({model,reasoning_effort:'low',include_reasoning:false,max_completion_tokens:768,messages:[{role:'system',content:'Choose varied everyday mixed meals from this public catalogue. Prefer chicken or fish for lunch and dinner and eggs or dairy for breakfast. Fruit, oats and yoghurt are ordinary breakfast/snack foods. Vegetarian or vegan main dishes require an explicit preference, which GymIQ applies locally. Return only recipe IDs. Do not calculate calories or invent meals.'},{role:'user',content:JSON.stringify(facts)}],response_format:{type:'json_schema',json_schema:{name:'meal_selection',strict:true,schema:{type:'object',additionalProperties:false,required:SLOTS,properties}}}})});
          if(!response.ok)throw Error('Provider unavailable');
          const data=await response.json();
          const tokens=Number(data.usage?.total_tokens);
          if(Number.isInteger(tokens)&&tokens>=0)await db.from('ai_review_attempts').update({total_tokens:tokens}).eq('id',reservation.data.id);
          const proposed=JSON.parse(data.choices?.[0]?.message?.content||'null');
          if(data.choices?.[0]?.finish_reason!=='stop'||!valid(proposed))throw Error('Invalid selection');
          selection=proposed;source='groq';reason='generated';
          await db.from('ai_review_cache').upsert({user_id:user.id,review_domain:'nutrition',snapshot_hash:hash,review:selection,model,consented_at:new Date().toISOString()},{onConflict:'user_id,review_domain,snapshot_hash'});
        }catch{reason='temporarily_unavailable';}
      }
    }else if(body.consent===true)reason='not_configured';
    let plan;
    try{plan=buildPlan(Number(result.target),foods,settings.diet,settings.excludes,selection);}catch(e){return json({error:(e as Error).message},400);}
    const saved=await db.from('nutrition_meal_plans').upsert({user_id:user.id,day:today,source,plan,target:result.target,created_at:new Date().toISOString()},{onConflict:'user_id,day'});
    if(saved.error)throw Error('Plan save failed');
    return json({plan,source,reason,target:result.target});
  }catch{return json({error:'Your planner could not be saved. Please try again.'},500);}
});
