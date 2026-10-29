import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import foods from '../../../supabase/functions/_shared/nutrition/foods.json';
import { RECIPES, SLOTS, calorieGuide, mealTotals, localDay, periodSummary, eligibleRecipes, planMatchesDiet } from '../../../supabase/functions/_shared/nutrition/planner.js';
import './nutrition.css';

const initial={sex:'female',age:'',height_cm:'',weight_kg:'',goal_weight_kg:'',monthly_loss_kg:1,activity_level:'sedentary',gym_days:3,gym_minutes:45,gym_basis:'planned',diet:'regular',excludes:[],general_plan:false};
const blankMeal=()=>({id:crypto.randomUUID(),name:'',slot:'breakfast',items:[{food_id:foods[0].id,grams:50}],manual:false,kcal:''});
const format=n=>Math.round(Number(n)||0).toLocaleString();
const startOfWeek=day=>{const d=new Date(`${day}T12:00:00`);d.setDate(d.getDate()-(d.getDay()+6)%7);return localDay(d);};
async function invoke(body){
  const {data,error}=await supabase.functions.invoke('gymiq-meal-plan',{body:{...body,offset:new Date().getTimezoneOffset()}});
  if(error){let message;try{message=(await error.context.json()).error;}catch{/* generic network error */}throw Error(message||'Could not reach the planner. Please try again.');}
  if(data?.error)throw Error(data.error);
  return data;
}
export default function NutritionHub({userId}){
  const [day,setDay]=useState(localDay()),[settings,setSettings]=useState(initial),[goal,setGoal]=useState(null),[showGoal,setShowGoal]=useState(false);
  const [days,setDays]=useState([]),[entries,setEntries]=useState([]),[saved,setSaved]=useState([]),[plan,setPlan]=useState(null);
  const [meal,setMeal]=useState(blankMeal),[editing,setEditing]=useState(false),[consent,setConsent]=useState(false),[period,setPeriod]=useState('day');
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [weights,setWeights]=useState([]),[weighIn,setWeighIn]=useState('');
  const today=localDay();
  useEffect(()=>{let active=true;setLoading(true);setError('');
    async function load(){
      const results=await Promise.all([
        supabase.from('nutrition_goals').select('*').eq('user_id',userId).maybeSingle(),
        supabase.rpc('nutrition_period',{p_day:day,p_offset:new Date().getTimezoneOffset()}),
        supabase.rpc('nutrition_food_entries',{p_day:day,p_offset:new Date().getTimezoneOffset()}),
        supabase.from('saved_meals').select('*').eq('user_id',userId).order('created_at',{ascending:false}),
        supabase.from('nutrition_meal_plans').select('*').eq('user_id',userId).eq('day',day).maybeSingle(),
        supabase.from('calorie_bank').select('*').eq('user_id',userId).maybeSingle(),
        supabase.from('body_metrics').select('metric_date,weight_kg').eq('client_id',userId).not('weight_kg','is',null).order('metric_date',{ascending:false}).limit(12),
      ]);
      if(!active)return;
      if(results.some(r=>r.error)){setError('Your nutrition records could not load. Reload this page to try again.');setLoading(false);return;}
      const [g,d,e,m,p,legacy,w]=results.map(r=>r.data);
      setGoal(g);setDays(d||[]);setEntries(e||[]);setSaved(m||[]);setPlan(p);
      setWeights(w||[]);
      if(g)setSettings({...initial,...g.settings});
      else if(legacy)setSettings({...initial,sex:legacy.sex||initial.sex,age:legacy.age||'',height_cm:legacy.height_cm||'',weight_kg:legacy.weight_kg||'',goal_weight_kg:legacy.goal_weight_kg||''});
      setShowGoal(!g);setLoading(false);
    }
    load().catch(()=>{if(active){setError('Your nutrition records could not load. Please reload.');setLoading(false);}});
    return()=>{active=false;};
  },[userId,day]);
  async function refresh(){
    const [d,e]=await Promise.all([supabase.rpc('nutrition_period',{p_day:day,p_offset:new Date().getTimezoneOffset()}),supabase.rpc('nutrition_food_entries',{p_day:day,p_offset:new Date().getTimezoneOffset()})]);
    if(d.error||e.error)throw Error('Saved, but totals could not refresh. Reload to see the latest records.');
    setDays(d.data||[]);setEntries(e.data||[]);
  }
  async function action(fn){if(busy)return;setBusy(true);setError('');setNotice('');try{await fn();}catch(e){setError(e.message||'Could not save. Please try again.');}finally{setBusy(false);}}
  async function saveGoal(e){e.preventDefault();await action(async()=>{
    const data=await invoke({action:'goal',settings});
    setGoal({settings:data.settings,result:data.result});setShowGoal(false);
    await refresh();setNotice('Goal saved from today. Earlier calorie guides stay unchanged. Rebuild today’s plan to use the new guide.');
  });}
  async function generate(withAi){await action(async()=>{
    const data=await invoke({action:'plan',consent:withAi&&consent});
    setPlan({...data,day:today});
    setNotice(data.source==='groq'?'AI meal choices ready. GymIQ applied your preferences and calculated portions.':withAi?'AI is unavailable or its allowance is used up. A basic plan is ready.':'Your basic meal plan is ready.');
  });}
  function choose(m){setMeal({id:crypto.randomUUID(),name:m.name,slot:m.slot,items:m.items.map(i=>({...i})),manual:false,kcal:''});setEditing(false);document.getElementById('meal-builder')?.scrollIntoView({behavior:'smooth',block:'start'});}
  async function logMeal(e){e.preventDefault();await action(async()=>{
    const {error}=await supabase.rpc('log_nutrition_food',{p_id:meal.id,p_day:day,p_slot:meal.slot,p_name:meal.name,p_items:meal.manual?null:meal.items,p_kcal:meal.manual?Number(meal.kcal):null});
    if(error)throw Error(error.message);
    await refresh();setMeal(blankMeal());setEditing(false);setNotice(editing?'Food entry corrected. Totals updated.':'Food logged. Your totals are updated.');
  });}
  async function saveMeal(){await action(async()=>{
    mealTotals(meal.items,foods);
    if(!meal.name.trim())throw Error('Give your meal a name first.');
    const {data,error}=await supabase.from('saved_meals').insert({user_id:userId,name:meal.name.trim(),slot:meal.slot,items:meal.items}).select().single();
    if(error)throw Error('Could not save this meal.');setSaved(v=>[data,...v]);setNotice('Meal saved to your library. It has not been logged as eaten.');
  });}
  async function removeFood(entry){await action(async()=>{
    const {error}=await supabase.from('calorie_transactions').delete().eq('id',entry.id).eq('user_id',userId).eq('kind','food');
    if(error)throw Error('Could not remove that entry.');
    const cleared=await supabase.from('nutrition_day_status').delete().eq('user_id',userId).eq('day',day);
    if(cleared.error)throw Error('Entry removed, but day status could not refresh. Reload to retry.');
    await refresh();setNotice('Food entry removed. Totals updated.');
  });}
  function edit(entry){setMeal({id:entry.id,name:entry.label||'Food',slot:entry.meal_slot||'snack',items:entry.meal_snapshot?.items||blankMeal().items,manual:!entry.meal_snapshot?.items,kcal:Math.abs(entry.kcal)});setEditing(true);document.getElementById('meal-builder')?.scrollIntoView({behavior:'smooth'});}
  const update=(key,value)=>setSettings(s=>({...s,[key]:value}));
  const updateItem=(index,key,value)=>setMeal(m=>({...m,items:m.items.map((i,n)=>n===index?{...i,[key]:value}:i)}));
  let preview=null,mealTotal=null;
  try{if(settings.gym_basis==='planned')preview=calorieGuide(settings);}catch{/* show validation on save */}
  try{if(!meal.manual)mealTotal=mealTotals(meal.items,foods);}catch{/* invalid intermediate form state */}
  const preferences=goal?.settings||{diet:'regular',excludes:[]};
  const presets=eligibleRecipes(foods,preferences.diet,preferences.excludes);
  const planCompatible=!plan||planMatchesDiet(plan.plan,foods,preferences.diet,preferences.excludes);
  const dayData=days.find(d=>d.day===day),currentTarget=dayData?.target;
  const summary=periodSummary(days,period==='day'?day:period==='week'?startOfWeek(day):day.slice(0,7)+'-01',day);
  const difference=summary.logged-summary.guide;
  if(loading)return <div className="mf-card" role="status">Loading your food & goals…</div>;
  return <div className="nutrition-hub">
    {error&&<p className="inline-error mf-card" role="alert">{error}</p>}
    {notice&&<p className="nutrition-notice" role="status">{notice}</p>}
    <section className="mf-card nutrition-overview">
      <div className="section-heading"><div><span className="nutrition-eyebrow">FOOD & FOCUS</span><h2>Fuel your progress.</h2></div><button className="btn btn-ghost" onClick={()=>setShowGoal(v=>!v)}>{showGoal?'Close goals':'Edit goals'}</button></div>
      <label className="nutrition-date">Viewing day<input type="date" disabled={busy} value={day} max={today} min={localDay(new Date(Date.now()-365*86400000))} onChange={e=>{if(e.target.value){setDay(e.target.value);setMeal(blankMeal());setEditing(false);}}}/></label>
      <div className="nutrition-numbers"><div><span>Food logged</span><strong>{format(dayData?.kcal)}<small> kcal</small></strong></div><div><span>Daily guide · estimate</span><strong>{currentTarget?format(currentTarget):'—'}<small>{currentTarget?' kcal':''}</small></strong></div></div>
      {currentTarget&&<><div className="nutrition-meter" role="meter" aria-label="Calories logged against daily guide" aria-valuemin={0} aria-valuemax={currentTarget} aria-valuenow={Math.min(dayData?.kcal||0,currentTarget)}><span style={{width:`${Math.min(100,(dayData?.kcal||0)/currentTarget*100)}%`}}/></div><p className="subtle">{(dayData?.kcal||0)>currentTarget?`${format(dayData.kcal-currentTarget)} kcal above the guide so far. Return to your usual meals; no need to skip food tomorrow.`:`${format(currentTarget-(dayData?.kcal||0))} kcal between your logged food and guide. Logs may be incomplete.`}</p></>}
      {!goal&&<p className="subtle">Set a monthly goal for a calorie guide and meal plan. You can log food at any time.</p>}
      {goal&&<p className="subtle">Requested: {goal.settings.monthly_loss_kg} kg per 30 days · Modelled pace: about {goal.result.monthly_loss_kg} kg. Results vary. Gym activity is already included once.</p>}
    </section>
    {showGoal&&<section className="mf-card"><h2>Your monthly goal</h2><p className="subtle">For general adult planning. Use 0 kg for maintenance. This tool does not provide a weight-gain plan. Limits may reduce the requested pace.</p><form onSubmit={saveGoal} className="nutrition-form">
      <div className="nutrition-fields"><label>Sex used for energy estimate<select value={settings.sex} onChange={e=>update('sex',e.target.value)}><option value="female">Female</option><option value="male">Male</option></select></label>
      {[['age','Age · years',18,85,1],['height_cm','Height · cm',130,230,.1],['weight_kg','Current weight · kg',35,300,.1],['goal_weight_kg','Goal weight · kg',35,300,.1],['monthly_loss_kg','Wanted loss · kg / 30 days',0,4,.1]].map(([key,label,min,max,step])=><label key={key}>{label}<input required type="number" inputMode="decimal" min={min} max={max} step={step} value={settings[key]} onChange={e=>update(key,e.target.value)}/></label>)}
      <label>Daily activity outside the gym<select value={settings.activity_level} onChange={e=>update('activity_level',e.target.value)}><option value="sedentary">Mostly sitting</option><option value="light">Some walking / standing</option><option value="moderate">Active work / much walking</option></select></label>
      <label>Gym activity estimate<select value={settings.gym_basis} onChange={e=>update('gym_basis',e.target.value)}><option value="planned">My planned weekly schedule</option><option value="recorded">Finished sessions · last 28 days</option></select></label>
      {settings.gym_basis==='planned'&&<><label>Gym days per week<input type="number" min="0" max="7" step="1" required value={settings.gym_days} onChange={e=>update('gym_days',e.target.value)}/></label><label>Minutes per session<input type="number" min="0" max="180" step="1" required value={settings.gym_minutes} onChange={e=>update('gym_minutes',e.target.value)}/></label></>}
      <label>Meal preference<select value={settings.diet} onChange={e=>update('diet',e.target.value)}><option value="regular">Mixed meals · meat, fish & eggs (default)</option><option value="vegetarian">Vegetarian</option><option value="vegan">Vegan</option></select></label></div>
      <fieldset className="nutrition-exclusions"><legend>Ingredients to exclude from generated plans</legend>{['milk','egg','fish','wheat','gluten','soy','nuts'].map(a=><label key={a}><input type="checkbox" checked={settings.excludes.includes(a)} onChange={e=>update('excludes',e.target.checked?[...settings.excludes,a]:settings.excludes.filter(x=>x!==a))}/>{a}</label>)}</fieldset>
      <p className="subtle">Exclusions filter listed ingredients. Check packaging and preparation for other allergens and cross-contact. These presets are not a clinical diet or an allergy guarantee.</p>
      <label className="nutrition-check"><input type="checkbox" required checked={settings.general_plan} onChange={e=>update('general_plan',e.target.checked)}/><span>I am an adult and this general planner is appropriate for me. I am not pregnant or breastfeeding, and do not need a clinician-prescribed diet or support for an eating disorder. Otherwise, I will use food logging and seek an individual plan.</span></label>
      {preview&&<p className="nutrition-preview">Estimated guide <strong>{format(preview.target)} kcal/day</strong> · maintenance {format(preview.maintenance)} · gym contribution {format(preview.gym_kcal)}/day averaged over the week.</p>}
      <p className="subtle">Gym calories are rough estimates and include rest periods in recorded session time. Save again after your weight or routine changes. New goals take effect today, without rewriting earlier days.</p>
      <button className="btn btn-primary" disabled={busy||day!==today}>Save monthly goal</button>{day!==today&&<p className="subtle">Switch to today to change your goal.</p>}
    </form></section>}
    <section className="mf-card"><div className="section-heading"><h2>Your daily meal plan</h2><span className="badge badge-neutral">{plan?.source==='groq'?'AI-assisted':'Portions calculated'}</span></div>
      <p className="subtle">Mixed meals with meat or fish at lunch and dinner by default. Vegetarian main meals appear only when selected in Edit goals. Planning does not log food. Adjust portions in the builder before marking a meal as eaten.</p>
      {goal&&day===today&&<><label className="nutrition-check"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>Use Groq to choose from the public recipe catalogue. Your calorie target, measurements, preferences and food logs stay in GymIQ for this meal-planning request.</span></label><div className="launch-actions"><button className="btn btn-primary" disabled={busy||!consent} onClick={()=>generate(true)}>Build with AI</button><button className="btn btn-secondary" disabled={busy} onClick={()=>generate(false)}>Build basic plan</button></div></>}
      {plan&&!planCompatible&&<p className="nutrition-notice">This saved plan does not match your meal preference. Rebuild today’s plan for the updated choices. Your logged food stays unchanged.</p>}
      {plan&&planCompatible&&<><p className="subtle">{plan.source==='groq'?'Groq chose recipes; GymIQ filtered preferences and calculated portions.':'Basic plan · rule-based choices.'} Plan: {format(plan.plan.reduce((n,m)=>n+m.kcal,0))} kcal · guide when built: {format(plan.target)}. {goal&&plan.target!==goal.result.target?'Your guide has changed; rebuild the plan.':''}</p><div className="nutrition-plan-grid">{plan.plan.map(m=><article className="nutrition-meal" key={m.slot}><span className="nutrition-eyebrow">{m.slot}</span><h3>{m.name}</h3><strong>{format(m.kcal)} <small>kcal</small></strong><p className="subtle">{format(m.protein)} g protein · {format(m.carbs)} g carbs · {format(m.fat)} g fat</p><details><summary>Ingredients & portions</summary><ul>{m.items.map((i,n)=><li key={n}>{format(i.grams)} g {foods.find(f=>f.id===i.food_id)?.name}</li>)}</ul></details><button className="btn btn-secondary" disabled={busy} onClick={()=>choose(m)}>Use in meal builder</button></article>)}</div></>}
      {!plan&&<p className="subtle">{goal?'Build today’s plan, or start with a preset below.':'Save your goal above to generate a plan. The meal builder below works without a goal.'}</p>}
    </section>
    <section className="mf-card" id="meal-builder"><h2>{editing?'Correct food entry':'Meal builder & extra food'}</h2><p className="subtle">Log what you actually ate on {day}. Include drinks, sauces, oil and extras. Weights are edible portions; cooked and dry foods differ.</p>
      <label>Start with a preset or saved meal<select value="" disabled={busy} onChange={e=>{const m=[...RECIPES,...saved].find(m=>m.id===e.target.value);if(m)choose(m);}}><option value="">Choose a meal…</option><optgroup label="Everyday presets">{presets.map(m=><option value={m.id} key={m.id}>{m.name}</option>)}</optgroup><optgroup label="My saved meals">{saved.map(m=><option value={m.id} key={m.id}>{m.name}</option>)}</optgroup></select></label>
      <form onSubmit={logMeal} className="nutrition-form"><div className="nutrition-fields"><label>Meal or food name<input required maxLength="100" value={meal.name} onChange={e=>setMeal(m=>({...m,name:e.target.value}))}/></label><label>Meal time<select value={meal.slot} onChange={e=>setMeal(m=>({...m,slot:e.target.value}))}>{SLOTS.map(s=><option value={s} key={s}>{s}</option>)}</select></label></div>
      <label className="nutrition-check"><input type="checkbox" checked={meal.manual} onChange={e=>setMeal(m=>({...m,manual:e.target.checked}))}/>Enter calories from a food label instead</label>
      {meal.manual?<label>Calories eaten · kcal<input type="number" min="1" max="10000" required step="1" value={meal.kcal} onChange={e=>setMeal(m=>({...m,kcal:e.target.value}))}/></label>:<><div className="nutrition-ingredients">{meal.items.map((i,n)=><div className="nutrition-ingredient" key={n}><label>Ingredient {n+1}<select value={i.food_id} onChange={e=>updateItem(n,'food_id',e.target.value)}>{foods.map(f=><option value={f.id} key={f.id}>{f.name}</option>)}</select></label><label>Grams<input type="number" inputMode="decimal" step="0.1" min="1" max="1500" required value={i.grams} onChange={e=>updateItem(n,'grams',e.target.value)}/></label><button type="button" className="btn btn-ghost" aria-label={`Remove ingredient ${n+1}`} disabled={meal.items.length===1} onClick={()=>setMeal(m=>({...m,items:m.items.filter((_,j)=>j!==n)}))}>×</button></div>)}</div><button type="button" className="btn btn-ghost" disabled={meal.items.length>=30} onClick={()=>setMeal(m=>({...m,items:[...m.items,{food_id:foods[0].id,grams:50}]}))}>+ Add ingredient</button><p className="nutrition-preview">{mealTotal?`${format(mealTotal.kcal)} kcal · ${format(mealTotal.protein)} g protein · ${format(mealTotal.carbs)} g carbs · ${format(mealTotal.fat)} g fat`:'Check ingredient quantities.'}</p></>}
      <div className="launch-actions"><button type="submit" className="btn btn-primary" disabled={busy}>{busy?'Saving…':editing?'Save correction':'Log as eaten'}</button>{!meal.manual&&<button type="button" className="btn btn-secondary" disabled={busy} onClick={saveMeal}>Save meal template</button>}<button type="button" className="btn btn-ghost" disabled={busy} onClick={()=>{setMeal(blankMeal());setEditing(false);}}>Cancel / clear</button></div></form>
      {saved.length>0&&<details><summary>Manage saved meals · {saved.length}</summary>{saved.map(m=><div className="nutrition-log" key={m.id}><span>{m.name}</span><button className="btn btn-ghost" disabled={busy} onClick={()=>action(async()=>{const {error}=await supabase.from('saved_meals').delete().eq('id',m.id).eq('user_id',userId);if(error)throw Error('Could not remove template.');setSaved(v=>v.filter(s=>s.id!==m.id));})}>Remove template</button></div>)}</details>}
    </section>
    <section className="mf-card"><h2>Food diary</h2>{entries.length===0?<p className="subtle">Nothing logged for this day. Missing logs do not mean no food was eaten.</p>:entries.map(e=><div className="nutrition-log" key={e.id}><div><strong>{e.label||'Food'}</strong><p className="subtle">{e.meal_slot||'Food'} · {format(Math.abs(e.kcal))} kcal</p></div><div className="launch-actions"><button className="btn btn-ghost" disabled={busy} onClick={()=>edit(e)}>Edit</button><button className="btn btn-ghost" disabled={busy} onClick={()=>removeFood(e)}>Remove</button></div></div>)}
      <label className="nutrition-check"><input type="checkbox" checked={dayData?.complete||false} disabled={busy||entries.length===0} onChange={e=>{const complete=e.target.checked;const previous=dayData?.complete||false;setDays(v=>v.map(d=>d.day===day?{...d,complete}:d));action(async()=>{const {error}=await supabase.from('nutrition_day_status').upsert({user_id:userId,day,complete},{onConflict:'user_id,day'});if(error){setDays(v=>v.map(d=>d.day===day?{...d,complete:previous}:d));throw Error('Could not update day status.');}await refresh();});}}/>I’ve finished logging all food and drinks for this day</label>
    </section>
    <section className="mf-card"><h2>The bigger picture</h2><div className="nutrition-periods" aria-label="Food summary period">{['day','week','month'].map(p=><button className={`btn ${period===p?'btn-primary':'btn-ghost'}`} aria-pressed={period===p} key={p} onClick={()=>setPeriod(p)}>{p==='day'?'Day':p==='week'?'Week to date':'Month to date'}</button>)}</div>
      <div className="nutrition-numbers"><div><span>Food logged</span><strong>{format(summary.logged)}<small> kcal</small></strong></div><div><span>Guide · {summary.guideDays} known days</span><strong>{summary.guideDays?format(summary.guide):'—'}<small>{summary.guideDays?' kcal':''}</small></strong></div></div>
      <p className="subtle">{summary.loggedDays} of {summary.days} days have entries · {summary.completeDays} marked complete. {summary.guideDays<summary.days?'Some days have no saved guide; those targets are unknown.':''}</p>
      {summary.guideDays===summary.days&&summary.guideDays>0&&<p>{format(Math.abs(difference))} kcal {difference>0?'above':'below'} the guide in the records so far. {summary.completeDays<summary.days?'Logging is incomplete; this is not a measured calorie deficit.':''}</p>}
      <p className="subtle">Extra food changes these totals. It does not create calorie debt or reduce tomorrow’s guide. Return to regular meals and review your weight trend over time; do not fast or add punitive workouts to compensate.</p>
      <details><summary>Daily records</summary>{days.map(d=><div className="nutrition-log" key={d.day}><span>{d.day}<small className="subtle"> · {d.complete?'complete':d.entries?'partial':'not logged'}</small></span><span>{format(d.kcal)} / {d.target?format(d.target):'—'} kcal</span></div>)}</details>
    </section>
    <section className="mf-card"><h2>Weight check-ins</h2><p className="subtle">Follow the trend over several weeks. A check-in does not automatically change your calorie guide.</p><form className="nutrition-form" onSubmit={e=>{e.preventDefault();action(async()=>{const weight=Number(weighIn);if(!Number.isFinite(weight)||weight<35||weight>300)throw Error('Enter a weight between 35 and 300 kg.');const {error}=await supabase.from('body_metrics').upsert({client_id:userId,metric_date:day,weight_kg:weight},{onConflict:'client_id,metric_date'});if(error)throw Error('Could not save your check-in.');setWeights(v=>[{metric_date:day,weight_kg:weight},...v.filter(w=>w.metric_date!==day)].sort((a,b)=>b.metric_date.localeCompare(a.metric_date)).slice(0,12));setWeighIn('');setNotice('Weight check-in saved. Update your current weight in Edit goals when you want to recalculate the guide.');});}}><label>Weight on {day} · kg<input type="number" inputMode="decimal" min="35" max="300" step="0.1" required value={weighIn} onChange={e=>setWeighIn(e.target.value)}/></label><button className="btn btn-secondary" disabled={busy}>Save weight check-in</button></form><details><summary>Recent check-ins · {weights.length}</summary>{weights.map(w=><div className="nutrition-log" key={w.metric_date}><span>{w.metric_date}</span><strong>{w.weight_kg} kg</strong></div>)}</details></section>
    <details className="mf-card nutrition-sources"><summary>How the estimates work & food sources</summary><p>GymIQ uses a general resting-energy equation, your non-gym activity and an estimated net gym contribution. Recorded sessions use the last 28 days and exclude cancelled or implausibly long sessions. These estimates are refreshed when you save goals; workout calories are not added again as food credits.</p><p>A 30-day weight-change model uses 7,700 kcal per kg. Real changes are not linear. The planner caps its estimated deficit at 500 kcal/day, 25% of maintenance, and a floor of the higher of estimated resting needs or 1,500 kcal/day. These are product guardrails, not a guarantee that a diet is appropriate for you.</p><p>Food values come from <a href="https://fdc.nal.usda.gov/download-datasets/" target="_blank" rel="noreferrer">USDA FoodData Central SR Legacy</a>. Actual brands, portions and cooking methods vary. Use packaging values for unlisted foods. Presets follow everyday balanced-meal patterns, not a clinically approved diet.</p><p><a href="https://pacompendium.com/conditioning-exercise/" target="_blank" rel="noreferrer">Activity estimate source</a> · <a href="https://www.canada.ca/en/health-canada/services/food-guide/eating-support/cooking/make-healthy-meals-plate.html" target="_blank" rel="noreferrer">Balanced meal guidance</a></p></details>
  </div>;
}
