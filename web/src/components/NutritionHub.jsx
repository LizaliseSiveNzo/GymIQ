import { Fragment, lazy, Suspense, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import {readView,saveView} from '../lib/deviceCache.js';
import foods from '../../../supabase/functions/_shared/nutrition/foods.json';
import { RECIPES, SLOTS, WEEKLY_PLANS, calorieGuide, mealTotals, localDay, periodSummary, eligibleRecipes, planMatchesDiet } from '../../../supabase/functions/_shared/nutrition/planner.js';
import './nutrition.css';
import {useLogSync} from '../context/LogSyncContext.jsx';
import {subscribeSynced} from '../lib/logQueue.js';
import QuickMeals,{foodAsMeal,mealPayload} from './ui/QuickMeals.jsx';
import BarcodeFood from './ui/BarcodeFood.jsx';
import FoodImage from './ui/FoodImage.jsx';
import FoodPicker from './ui/FoodPicker.jsx';
import {analyzeMealPhoto} from '../lib/mealVision.js';
const AiReviewCard=lazy(()=>import('./ui/AiReviewCard.jsx'));

const initial={sex:'female',age:'',height_cm:'',weight_kg:'',goal_weight_kg:'',monthly_loss_kg:1,activity_level:'sedentary',gym_days:3,gym_minutes:45,gym_basis:'planned',diet:'regular',excludes:[],general_plan:false};
const blankMeal=()=>({id:crypto.randomUUID(),name:'',slot:'breakfast',items:[{food_id:foods[0].id,grams:50}],manual:false,kcal:''});
const format=n=>Math.round(Number(n)||0).toLocaleString();
const startOfWeek=day=>{const d=new Date(`${day}T12:00:00`);d.setDate(d.getDate()-(d.getDay()+6)%7);return localDay(d);};
const addDays=(day,n)=>{const d=new Date(`${day}T12:00:00`);d.setDate(d.getDate()+n);return localDay(d);};
const dateLabel=day=>new Date(`${day}T12:00:00`).toLocaleDateString(undefined,{day:'numeric',month:'short'});
async function invoke(body){
  const {data,error}=await supabase.functions.invoke('gymiq-meal-plan',{body:{...body,offset:new Date().getTimezoneOffset()}});
  if(error){let message;try{message=(await error.context.json()).error;}catch{/* generic network error */}throw Error(message||'Could not reach the planner. Please try again.');}
  if(data?.error)throw Error(data.error);
  return data;
}
export default function NutritionHub({userId,section='home',onSectionChange=()=>{}}){
  const sync=useLogSync();
  const [recent,setRecent]=useState([]),[favourites,setFavourites]=useState([]);
  const [day,setDay]=useState(localDay()),[settings,setSettings]=useState(initial),[goal,setGoal]=useState(null);
  const [days,setDays]=useState([]),[entries,setEntries]=useState([]),[saved,setSaved]=useState([]),[plan,setPlan]=useState(null);
  const [cards,setCards]=useState(()=>SLOTS.map(slot=>({...blankMeal(),slot}))),[editingId,setEditingId]=useState(null),[correcting,setCorrecting]=useState(null),[period,setPeriod]=useState('day');
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [weights,setWeights]=useState([]),[weighIn,setWeighIn]=useState('');
  const [photoBusy,setPhotoBusy]=useState(false),[photoResult,setPhotoResult]=useState(null),[photoError,setPhotoError]=useState(''),[photoPreview,setPhotoPreview]=useState(null),[photoItems,setPhotoItems]=useState(null);
  const photoInput=useRef(null);
  const today=localDay();
  const goalDialog=useRef(null);
  const [goalDismissed,setGoalDismissed]=useState(false);
  useEffect(()=>{let active=true;setLoading(true);setError('');
    const saved=readView(userId,`nutrition:${day}`);
    function show(values){
      const [g,d,e,m,p,legacy,recent,favourites,w,profile]=values;
      setRecent(recent||[]);setFavourites(favourites||[]);
      setGoal(g);setDays(d||[]);setEntries(e||[]);setSaved(m||[]);setPlan(p);
      setWeights(w||[]);
      if(g)setSettings({...initial,...g.settings});
      else if(legacy)setSettings({...initial,sex:legacy.sex||initial.sex,age:legacy.age||'',height_cm:legacy.height_cm||'',weight_kg:legacy.weight_kg||'',goal_weight_kg:legacy.goal_weight_kg||''});
      else if(profile)setSettings({...initial,sex:profile.sex||initial.sex,age:profile.dob?String(Math.max(18,Math.floor((Date.now()-new Date(profile.dob+'T12:00:00').getTime())/(365.2425*86400000)))):'',height_cm:profile.height_cm||initial.height_cm});
      setLoading(false);
    }
    if(saved)show(saved.data);
    async function load(){
      if(!navigator.onLine){if(!saved){setLoading(false);setError('No saved food records for this day. The meal builder still works; connect to load your diary.');}return;}
      const results=await Promise.all([
        supabase.from('nutrition_goals').select('*').eq('user_id',userId).maybeSingle(),
        supabase.rpc('nutrition_period',{p_day:day,p_offset:new Date().getTimezoneOffset()}),
        supabase.rpc('nutrition_food_entries',{p_day:day,p_offset:new Date().getTimezoneOffset()}),
        supabase.from('saved_meals').select('*').eq('user_id',userId).order('created_at',{ascending:false}),
        supabase.from('nutrition_meal_plans').select('*').eq('user_id',userId).eq('day',day).maybeSingle(),
        supabase.from('calorie_bank').select('*').eq('user_id',userId).maybeSingle(),
        supabase.from('calorie_transactions').select('id,label,kcal,meal_slot,meal_snapshot,log_day').eq('user_id',userId).eq('kind','food').order('occurred_at',{ascending:false}).limit(30),
        supabase.from('food_favourites').select('*').eq('user_id',userId).order('created_at',{ascending:false}),
        supabase.from('body_metrics').select('metric_date,weight_kg').eq('client_id',userId).not('weight_kg','is',null).order('metric_date',{ascending:false}).limit(12),
        supabase.from('users').select('sex,dob,height_cm').eq('id',userId).maybeSingle(),
      ]);
      if(!active)return;
      if(results.some(r=>r.error)){if(!saved)setError('Your nutrition records could not load. Reconnect to retry.');setLoading(false);return;}
      const values=results.map(r=>r.data);saveView(userId,`nutrition:${day}`,values);show(values);
    }
    void load().catch(()=>{if(active){if(!saved)setError('Your nutrition records could not load. Please reconnect.');setLoading(false);}});
    window.addEventListener('online',load);
    return()=>{active=false;window.removeEventListener('online',load);};
  },[userId,day]);
  // Keep corrections and newly generated plans in the next offline snapshot.
  useEffect(()=>{
    if(loading)return;
    const previous=readView(userId,`nutrition:${day}`)?.data;
    if(!previous)return;
    saveView(userId,`nutrition:${day}`,[goal,days,entries,saved,plan,previous[5],recent,favourites,weights]);
  },[loading,userId,day,goal,days,entries,saved,plan,recent,favourites,weights]);
  async function refresh(){
    const [d,e]=await Promise.all([supabase.rpc('nutrition_period',{p_day:day,p_offset:new Date().getTimezoneOffset()}),supabase.rpc('nutrition_food_entries',{p_day:day,p_offset:new Date().getTimezoneOffset()})]);
    if(d.error||e.error)throw Error('Saved, but totals could not refresh. Reload to see the latest records.');
    setDays(d.data||[]);setEntries(e.data||[]);
  }
  useEffect(()=>subscribeSynced(entry=>{if(entry.userId===userId&&entry.kind==='food'){void refresh().catch(()=>setError('Food synced, but totals could not refresh. Reload when connected.'));supabase.from('calorie_transactions').select('id,label,kcal,meal_slot,meal_snapshot,log_day').eq('user_id',userId).eq('kind','food').order('occurred_at',{ascending:false}).limit(30).then(({data,error})=>{if(!error)setRecent(data||[]);});}}),[userId,day]);
  async function action(fn){if(busy)return;setBusy(true);setError('');setNotice('');try{await fn();}catch(e){setError(e.message||'Could not save. Please try again.');}finally{setBusy(false);}}
  async function saveGoal(e){e.preventDefault();await action(async()=>{
    const data=await invoke({action:'goal',settings});
    setGoal({settings:data.settings,result:data.result});onSectionChange('home');
    await refresh();setNotice('Goal saved from today. Earlier calorie guides stay unchanged. Rebuild today’s plan to use the new guide.');
  });}
  async function generate(withAi){await action(async()=>{
    const data=await invoke({action:'plan',consent:withAi});
    setPlan({...data,day:today});
    setNotice(data.source==='deepseek'?'AI meal choices ready. GymIQ applied your preferences and calculated portions.':withAi?'AI is unavailable or its allowance is used up. A basic plan is ready.':'Your basic meal plan is ready.');
  });}
  async function shuffle(slot='all'){await action(async()=>{
    const data=await invoke({action:'shuffle',slot});
    setPlan({...data,day:today});
    setNotice(slot==='all'?'All four meals shuffled. Your logged food is unchanged.':`${slot[0].toUpperCase()+slot.slice(1)} changed. The other meals and your food diary are unchanged.`);
  });}
  async function applyPreset(presetId){await action(async()=>{
    const data=await invoke({action:'preset',preset_id:presetId});
    setPlan({...data,day:today});
    setNotice('Preset applied to today. Tick meals in the builder when eaten.');
  });}
  async function setDefaultPlan(presetId){await action(async()=>{
    const data=await invoke({action:'default',preset_id:presetId});
    setGoal(g=>g?{...g,settings:data.settings}:g);
    setNotice('Daily default saved. New days will offer this plan.');
  });}
  function newCard(slot){return {...blankMeal(),slot};}
  const cardById=id=>cards.find(c=>c.id===id);
  const patchCard=(id,patch)=>setCards(cs=>cs.map(c=>c.id===id?{...c,...patch}:c));
  const patchCardItem=(id,index,key,value)=>setCards(cs=>cs.map(c=>c.id===id?{...c,items:c.items.map((i,n)=>n===index?{...i,[key]:value}:i)}:c));
  function cardKcal(card){if(card.manual)return card.kcal?`${format(card.kcal)} kcal`:'— kcal';try{const t=mealTotals(card.items,foods);return `${format(t.kcal)} kcal · P ${format(t.protein)}g · C ${format(t.carbs)}g · F ${format(t.fat)}g`;}catch{return '—';}}
  function choose(m){setCards(cs=>cs.map(c=>c.slot===m.slot?{...c,name:m.name,items:m.items.map(i=>({...i})),manual:false,kcal:'',eaten:false}:c));}
  function useQuick(value){const slot=value.slot||'snack';if(value.items)choose(value);else setCards(cs=>cs.map(c=>c.slot===slot?{...c,name:value.name,items:null,manual:true,kcal:String(value.kcal),eaten:false}:c));}
  function edit(entry){setCorrecting({id:entry.id,name:entry.label||'Food',slot:entry.meal_slot||'snack',items:entry.meal_snapshot?.items||null,manual:!entry.meal_snapshot?.items,kcal:Math.abs(entry.kcal)});onSectionChange('builder');}
  function addCard(){setCards(cs=>[...cs,newCard('snack')]);}
  function removeCard(id){setCards(cs=>cs.filter(c=>c.id!==id));}
  async function enqueueFood(value,id){
    if(!value.name.trim())throw Error('Give the food a name first.');
    if(value.items)mealTotals(value.items,foods);
    else if(!Number.isInteger(Number(value.kcal))||Number(value.kcal)<1||Number(value.kcal)>10000)throw Error('Enter 1–10,000 whole calories.');
    await sync.enqueue('food',mealPayload(value,day),id);
  }
  async function onPhotoFile(e){
    const file=e.target.files?.[0];e.target.value='';
    if(!file)return;
    setPhotoBusy(true);setPhotoError('');setPhotoResult(null);setPhotoPreview(URL.createObjectURL(file));
    try{const result=await analyzeMealPhoto(file);setPhotoResult(result);setPhotoItems(result.foods||[]);}
    catch(err){setPhotoError(err.message||'Could not analyse that photo.');}
    finally{setPhotoBusy(false);}
  }
  function patchPhotoItem(i,patch){setPhotoItems(prev=>prev.map((f,n)=>n===i?{...f,...patch}:f));}
  function photoTotals(){const items=(photoItems||[]).filter(f=>f.food_id&&f.grams>0).map(f=>({food_id:f.food_id,grams:f.grams}));if(!items.length)return {kcal:0,protein:0,carbs:0,fat:0};try{return mealTotals(items,foods);}catch{return {kcal:0,protein:0,carbs:0,fat:0};}}
  function logPhotoMeal(){
    const items=(photoItems||[]).filter(f=>f.food_id&&f.grams>0).map(f=>({food_id:f.food_id,grams:f.grams}));
    if(!items.length){setPhotoError('No recognisable foods matched the library. Pick a food or log it manually instead.');return;}
    const name=(photoItems||[]).filter(f=>f.food_id).map(f=>f.name).slice(0,3).join(' + ');
    action(async()=>{await enqueueFood({name,slot:'snack',items,kcal:null},crypto.randomUUID());setPhotoResult(null);setPhotoPreview(null);setPhotoItems(null);});
  }
  async function toggleEaten(card){
    if(busy)return;
    await action(async()=>{
      if(card.eaten){
        await sync.forget(card.id);
        if(sync.online){const {error}=await supabase.from('calorie_transactions').delete().eq('id',card.id).eq('user_id',userId).eq('kind','food');if(error)throw Error('Could not remove that entry.');}
        patchCard(card.id,{eaten:false});
        await refresh();
      }else{
        if(!card.name.trim())throw Error('Name this meal before ticking it.');
        if(card.items)mealTotals(card.items,foods);
        else if(!Number.isInteger(Number(card.kcal))||Number(card.kcal)<1||Number(card.kcal)>10000)throw Error('Enter valid calories.');
        await sync.enqueue('food',mealPayload({name:card.name,slot:card.slot,items:card.manual?null:card.items,kcal:Number(card.kcal)},day),card.id);
        patchCard(card.id,{eaten:true});
        setNotice('Meal ticked. It enters your diary and totals after sync.');
      }
    });
  }
  function saveCard(){const card=cardById(editingId);if(!card)return;if(!card.name.trim()){setError('Give the meal a name first.');return;}if(card.items)try{mealTotals(card.items,foods);}catch(e){setError(e.message);return;}else if(!Number.isInteger(Number(card.kcal))||Number(card.kcal)<1||Number(card.kcal)>10000){setError('Enter valid calories.');return;}setEditingId(null);setNotice('Meal saved. Tick it when eaten.');}
  async function saveCorrection(e){e.preventDefault();await action(async()=>{
    if(!sync.online)throw Error('Connect before correcting a saved entry.');
    const {error}=await supabase.rpc('log_nutrition_food',{p_id:correcting.id,p_day:day,p_slot:correcting.slot,p_name:correcting.name,p_items:correcting.manual?null:correcting.items,p_kcal:correcting.manual?Number(correcting.kcal):null});
    if(error)throw Error(error.message);
    setCorrecting(null);await refresh();setNotice('Food entry corrected. Totals updated.');
  });}
  async function saveFavourite(){const card=cardById(editingId);if(!card)return;await action(async()=>{
    const value={name:card.name.trim(),slot:card.slot,items:card.manual?null:card.items,kcal:card.manual?Number(card.kcal):null};
    if(!value.name)throw Error('Give your favourite a name first.');
    if(value.items)mealTotals(value.items,foods);else if(!Number.isInteger(value.kcal)||value.kcal<1||value.kcal>10000)throw Error('Enter valid label calories.');
    const {data,error}=await supabase.from('food_favourites').upsert({user_id:userId,...value},{onConflict:'user_id,fingerprint'}).select().single();
    if(error)throw Error('Could not save your favourite.');setFavourites(v=>[data,...v.filter(f=>f.id!==data.id)]);setNotice('Favourite saved.');
  });}
  async function saveMeal(){const card=cardById(editingId);if(!card)return;await action(async()=>{
    mealTotals(card.items,foods);
    if(!card.name.trim())throw Error('Give your meal a name first.');
    const {data,error}=await supabase.from('saved_meals').insert({user_id:userId,name:card.name.trim(),slot:card.slot,items:card.items}).select().single();
    if(error)throw Error('Could not save this meal.');setSaved(v=>[data,...v]);setNotice('Meal saved to your library.');
  });}
  async function removeFood(entry){await action(async()=>{
    const {error}=await supabase.from('calorie_transactions').delete().eq('id',entry.id).eq('user_id',userId).eq('kind','food');
    if(error)throw Error('Could not remove that entry.');
    const cleared=await supabase.from('nutrition_day_status').delete().eq('user_id',userId).eq('day',day);
    if(cleared.error)throw Error('Entry removed, but day status could not refresh.');
    await refresh();setNotice('Food entry removed. Totals updated.');
  });}
  const update=(key,value)=>setSettings(s=>({...s,[key]:value}));
  let preview=null;
  try{if(settings.gym_basis==='planned')preview=calorieGuide(settings);}catch{/* show validation on save */}
  const preferences=goal?.settings||{diet:'regular',excludes:[]};
  const presets=eligibleRecipes(foods,preferences.diet,preferences.excludes);
  const planCompatible=!plan||planMatchesDiet(plan.plan,foods,preferences.diet,preferences.excludes);
  const dayData=days.find(d=>d.day===day);
  const periodStart=period==='day'?day:period==='week'?startOfWeek(day):day.slice(0,7)+'-01';
  const summary=periodSummary(days,periodStart,day);
  const dayMacros=entries.reduce((m,e)=>{if(e.meal_snapshot?.items){try{const t=mealTotals(e.meal_snapshot.items,foods);m.protein+=t.protein;m.carbs+=t.carbs;m.fat+=t.fat;}catch{}}return m;},{protein:0,carbs:0,fat:0});
  const guideKcal=summary.guide||0;
  const macroTargets={protein:guideKcal?Math.round(guideKcal*0.25/4):0,carbs:guideKcal?Math.round(guideKcal*0.45/4):0,fat:guideKcal?Math.round(guideKcal*0.30/9):0};
  const guideKnown=summary.guideDays===summary.days&&summary.guideDays>0;
  const periodName=period==='day'?'Daily':period==='week'?'Week':'Month';
  const weekStartDay=startOfWeek(day),currentWeekStart=startOfWeek(today);
  function shiftWeek(n){const d=addDays(startOfWeek(day),n);setDay(d);setCards(SLOTS.map(slot=>({...blankMeal(),slot})));setEditingId(null);setCorrecting(null);}
  const show=key=>section==='home'||section===key;
  useEffect(()=>{
    if(!loading && !goal && !goalDismissed && goalDialog.current){
      goalDialog.current.showModal();
    }
  },[loading,goal,goalDismissed]);
  const datePicker=<label className="nutrition-date">Viewing day<input type="date" disabled={busy} value={day} max={today} min={localDay(new Date(Date.now()-365*86400000))} onChange={e=>{if(e.target.value){setDay(e.target.value);setCards(SLOTS.map(slot=>({...blankMeal(),slot})));setEditingId(null);setCorrecting(null);}}}/></label>;
  if(loading)return <div className="mf-card" role="status">Loading your food & goals…</div>;
  return <div className="nutrition-hub">
    {error&&<p className="inline-error mf-card" role="alert">{error}</p>}
    {notice&&<p className="nutrition-notice" role="status">{notice}</p>}
    {section!=='home'&&!['sources','insights'].includes(section)&&<div className="nutrition-view-date">{datePicker}</div>}
    {section==='home'&&<section className="mf-card nutrition-overview">
      <div className="section-heading"><div><span className="nutrition-eyebrow">FOOD & FOCUS</span><h2>Calorie overview</h2></div><button className="btn btn-ghost" onClick={()=>onSectionChange('goals')}>Edit goals</button></div>
      <nav aria-label="Food week" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:10 }}><button type="button" className="btn btn-ghost" aria-label="Previous week" onClick={()=>shiftWeek(-7)}>←</button><div style={{ textAlign:'center', minWidth:0 }}><strong style={{ display:'block', fontSize:14 }}>{weekStartDay===currentWeekStart?'This week':'Previous week'}</strong><span style={{ fontSize:12, color:'var(--text-muted)' }}>{dateLabel(weekStartDay)} – {dateLabel(addDays(weekStartDay,6))}</span></div><button type="button" className="btn btn-ghost" aria-label="Next week" disabled={busy||weekStartDay>=currentWeekStart} onClick={()=>shiftWeek(7)}>→</button></nav>
      <div className="nutrition-periods" aria-label="Food summary period">{['day','week','month'].map(p=><button className={`btn ${period===p?'btn-primary':'btn-ghost'}`} aria-pressed={period===p} key={p} onClick={()=>setPeriod(p)}>{p==='day'?'Day':p==='week'?'Week to date':'Month to date'}</button>)}</div>
      <div className="nutrition-numbers"><div><span>Food logged</span><strong>{format(summary.logged)}<small> kcal</small></strong></div><div><span>{periodName} guide · estimate{!guideKnown&&summary.guideDays>0?` · ${summary.guideDays} known days`:''}</span><strong>{summary.guideDays?format(summary.guide):'—'}<small>{summary.guideDays?' kcal':''}</small></strong></div></div>
      {guideKnown&&summary.guide>0&&<div className="nutrition-meter" role="meter" aria-label={`${periodName} calories logged against guide`} aria-valuemin={0} aria-valuemax={summary.guide} aria-valuenow={Math.min(summary.logged,summary.guide)}><span style={{width:`${Math.min(100,summary.logged/summary.guide*100)}%`}}/></div>}
      <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
        {[['Protein', dayMacros.protein, macroTargets.protein], ['Carbs', dayMacros.carbs, macroTargets.carbs], ['Fat', dayMacros.fat, macroTargets.fat]].map(([label, value, target]) => (
          <div key={label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: 'var(--text-muted)' }}>{label}</span>
              <span>{format(value)} / {format(target)} g</span>
            </div>
            <div className="nutrition-meter" role="meter" aria-label={`${label} against suggested target`} aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.min(value, target)}><span style={{ width: `${target ? Math.min(100, value / target * 100) : 0}%` }} /></div>
          </div>
        ))}
      </div>
      {guideKcal > 0 && <p className="subtle" style={{ fontSize: 11, marginTop: 8 }}>Suggested split: 25% protein · 45% carbs · 30% fat of your daily guide.</p>}
    </section>}
    {section==='goals'&&<section className="mf-card"><h2>Your monthly goal</h2><p className="subtle">For general adult planning. Use 0 kg for maintenance. This tool does not provide a weight-gain plan. Limits may reduce the requested pace.</p><form onSubmit={saveGoal} className="nutrition-form">
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
    {show('plan')&&<section className="mf-card"><div className="section-heading"><h2>Your daily meal plan</h2><span className="badge badge-neutral">{plan?.plan?.some(m=>m.selection_method==='shuffle')?'Shuffled':plan?.source==='deepseek'?'AI-assisted':'Portions calculated'}</span></div>
      {goal&&day===today&&<><div className="launch-actions"><button className="btn btn-primary" disabled={busy} onClick={()=>generate(true)}>Build with AI</button><button className="btn btn-secondary" disabled={busy} onClick={()=>generate(false)}>Build basic plan</button></div></>}<details className="mf-card" style={{marginTop:12}}><summary>★ Favourites & recent meals</summary><QuickMeals recent={recent} favourites={favourites} day={day} busy={busy} onUse={useQuick} onLog={value=>action(()=>enqueueFood(value))} onRemove={entry=>action(async()=>{const {error}=await supabase.from('food_favourites').delete().eq('user_id',userId).eq('id',entry.id);if(error)throw Error('Could not remove favourite.');setFavourites(v=>v.filter(f=>f.id!==entry.id));})}/></details>
      {!plan&&goal?.settings?.default_plan&&day===today&&<button className="btn btn-secondary" disabled={busy} onClick={()=>applyPreset(goal.settings.default_plan)} style={{marginTop:12}}>Use your default plan</button>}
      <details className="mf-card" style={{marginTop:12}}><summary>📅 Weekly plans · plug-and-play day presets</summary><p className="subtle">A complete day of meals to apply as-is, or set as your repeating daily default so you don't have to think about your food plan.</p>{WEEKLY_PLANS.map(preset=>{const totalKcal=SLOTS.reduce((n,slot)=>{try{return n+mealTotals(preset.meals[slot].items,foods).kcal;}catch{return n;}},0);const isDefault=goal?.settings?.default_plan===preset.id;return <div className="mf-card" key={preset.id} style={{marginTop:8}}><div className="row between"><strong>{preset.name}</strong>{isDefault&&<span className="badge badge-neutral">Your default</span>}</div><p className="subtle" style={{margin:'4px 0'}}>{preset.description}</p><p className="subtle">≈ {format(totalKcal)} kcal/day</p><ul style={{fontSize:13,margin:'6px 0'}}>{SLOTS.map(slot=><li key={slot}><b>{slot}</b>: {preset.meals[slot].name} — {preset.meals[slot].items.map(i=>i.grams+'g').join(' + ')}</li>)}</ul><div className="launch-actions"><button className="btn btn-primary" disabled={busy||day!==today} onClick={()=>applyPreset(preset.id)}>Use today</button><button className="btn btn-secondary" disabled={busy||day!==today} onClick={()=>setDefaultPlan(preset.id)}>{isDefault?'Keep as default':'Set as daily default'}</button></div></div>;})}</details>
      {plan&&!planCompatible&&<p className="nutrition-notice">This saved plan does not match your meal preference. Rebuild today’s plan for the updated choices. Your logged food stays unchanged.</p>}
      {plan&&planCompatible&&<><p className="subtle">{plan.plan.some(m=>m.selection_method==='shuffle')?'Shuffled options · GymIQ calculated portions.':plan.source==='deepseek'?'DeepSeek prepared meal choices; GymIQ checked ingredients and calculated portions.':'Basic plan · rule-based choices.'} Plan: {format(plan.plan.reduce((n,m)=>n+m.kcal,0))} kcal · guide when built: {format(plan.target)}. {goal?.result?.target!=null&&plan.target!==goal.result.target?'Your guide has changed; rebuild the plan.':''}</p><div className="nutrition-plan-grid">{plan.plan.map((m,index)=><Fragment key={m.slot}><article className="nutrition-meal"><div className="nutrition-meal-heading"><span className="nutrition-eyebrow">{m.slot}</span><button className="btn btn-ghost nutrition-shuffle-one" aria-label={`Shuffle ${m.slot}`} disabled={busy||day!==today} onClick={()=>shuffle(m.slot)}>↻ Shuffle</button></div><h3>{m.name}</h3><strong>{format(m.kcal)} <small>kcal</small></strong><p className="subtle">{format(m.protein)} g protein · {format(m.carbs)} g carbs · {format(m.fat)} g fat</p><div className="nutrition-meal-thumbs">{m.items.map((i,n)=><FoodImage key={n} foodId={i.food_id}/>)}</div><details><summary>Ingredients & portions</summary><ul>{m.items.map((i,n)=><li className="nutrition-food-row" key={n}><FoodImage foodId={i.food_id}/><span>{format(i.grams)} g {foods.find(f=>f.id===i.food_id)?.name}</span></li>)}</ul>{m.preparation&&<p>{m.preparation}</p>}</details><button className="btn btn-secondary" disabled={busy} onClick={()=>choose(m)}>Use in meal builder</button></article>{index===1&&<div className="nutrition-shuffle-center"><button className="btn btn-primary" disabled={busy||day!==today} onClick={()=>shuffle('all')}>↻ Shuffle all meals</button><small>New choices. Same daily calorie guide.</small></div>}</Fragment>)}</div></>}
      {!plan&&!goal&&<p className="subtle">Save your goal above to generate a plan. The meal builder below works without a goal.</p>}
    </section>}
    {false && <QuickMeals recent={recent} favourites={favourites} day={day} busy={busy} onUse={useQuick} onLog={value=>action(()=>enqueueFood(value))} onRemove={entry=>action(async()=>{const {error}=await supabase.from('food_favourites').delete().eq('user_id',userId).eq('id',entry.id);if(error)throw Error('Could not remove favourite. Connect and try again.');setFavourites(v=>v.filter(f=>f.id!==entry.id));})}/>}
    {section==='barcode'&&<BarcodeFood expanded disabled={busy||!sync.online} onUse={value=>useQuick({...value,slot:'snack',items:null})}/>}
    {photoError&&<p className="inline-error" role="alert">{photoError}</p>}
    {photoBusy&&photoPreview&&<section className="mf-card" style={{ position: 'relative', overflow: 'hidden', textAlign: 'center', marginBottom: 12 }}>
      <img src={photoPreview} alt="Meal preview" style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 12, opacity: 0.45 }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <span className="photo-spinner" aria-hidden="true" />
        <span style={{ fontSize: 14, fontWeight: 600 }}>Analysing your meal…</span>
      </div>
    </section>}
    {photoResult&&<section className="mf-card" style={{ marginBottom: 12 }}>
      {photoPreview&&<img src={photoPreview} alt="Meal" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 12, marginBottom: 8 }} />}
      <div className="section-heading"><h2>Photo estimate</h2><button className="btn btn-ghost" onClick={()=>{setPhotoResult(null);setPhotoPreview(null);setPhotoItems(null);}} aria-label="Close">✕</button></div>
      <p className="subtle" style={{ marginBottom: 8 }}>Check the foods and adjust the amounts. Tap an unmatched food to pick the closest library item.</p>
      {(photoItems||[]).map((f,i)=><div className="nutrition-log" key={i} style={{ alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {f.food_id ? <span>{f.name}</span> : <FoodPicker foods={foods} value={null} onChange={foodId=>{const food=foods.find(x=>x.id===foodId);patchPhotoItem(i,{food_id:foodId,name:food?.name||f.name,estimated:false});}} />}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, flexShrink: 0 }}><input type="number" inputMode="decimal" min="1" max="2000" step="1" value={f.grams} onChange={e=>patchPhotoItem(i,{grams:Math.max(0,Number(e.target.value)||0)})} style={{ width: 64, textAlign: 'center' }} />g</label>
        {f.estimated&&!f.food_id&&<span className="badge badge-neutral" style={{ flexShrink: 0 }}>unmatched</span>}
      </div>)}
      <p className="subtle" style={{ margin: '8px 0' }}>Total: {format(photoTotals().kcal)} kcal · P {format(photoTotals().protein)}g · C {format(photoTotals().carbs)}g · F {format(photoTotals().fat)}g</p>
      <div className="launch-actions"><button className="btn btn-primary" disabled={busy||!(photoItems||[]).some(f=>f.food_id&&f.grams>0)} onClick={logPhotoMeal}>Log this meal</button></div>
    </section>}
    {show('builder')&&<section className="mf-card" id="meal-builder">
      {correcting?<><h2>Correct food entry</h2><form onSubmit={saveCorrection} className="nutrition-form"><div className="nutrition-fields"><label>Meal or food name<input required maxLength="100" value={correcting.name} onChange={e=>setCorrecting(c=>({...c,name:e.target.value}))}/></label><label>Meal time<select value={correcting.slot} onChange={e=>setCorrecting(c=>({...c,slot:e.target.value}))}>{SLOTS.map(s=><option value={s} key={s}>{s}</option>)}</select></label></div>{correcting.manual?<label>Calories eaten · kcal<input type="number" min="1" max="10000" required step="1" value={correcting.kcal} onChange={e=>setCorrecting(c=>({...c,kcal:e.target.value}))}/></label>:<p className="subtle">Ingredients are kept from the original entry.</p>}<div className="launch-actions"><button type="submit" className="btn btn-primary" disabled={busy}>{busy?'Saving…':'Save correction'}</button><button type="button" className="btn btn-ghost" disabled={busy} onClick={()=>setCorrecting(null)}>Cancel</button></div></form></>
      :editingId&&cardById(editingId)?<><h2>Edit meal</h2><form onSubmit={e=>{e.preventDefault();saveCard();}} className="nutrition-form"><div className="nutrition-fields"><label>Meal name<input required maxLength="100" value={cardById(editingId).name} onChange={e=>patchCard(editingId,{name:e.target.value})}/></label><label>Meal time<select value={cardById(editingId).slot} onChange={e=>patchCard(editingId,{slot:e.target.value})}>{SLOTS.map(s=><option value={s} key={s}>{s}</option>)}</select></label></div><label className="nutrition-check"><input type="checkbox" checked={cardById(editingId).manual} onChange={e=>patchCard(editingId,{manual:e.target.checked})}/>Enter calories from a food label instead</label>{cardById(editingId).manual?<label>Calories eaten · kcal<input type="number" min="1" max="10000" step="1" value={cardById(editingId).kcal} onChange={e=>patchCard(editingId,{kcal:e.target.value})}/></label>:<><div className="nutrition-ingredients">{cardById(editingId).items.map((i,n)=><div className="nutrition-ingredient" key={n}><FoodImage foodId={i.food_id}/><label>Ingredient {n+1}<FoodPicker foods={foods} value={i.food_id} onChange={foodId=>patchCardItem(editingId,n,'food_id',foodId)} /></label><label>Grams<input type="number" inputMode="decimal" step="0.1" min="1" max="1500" value={i.grams} onChange={e=>patchCardItem(editingId,n,'grams',e.target.value)}/></label><button type="button" className="btn btn-ghost" aria-label={`Remove ingredient ${n+1}`} disabled={cardById(editingId).items.length===1} onClick={()=>patchCard(editingId,{items:cardById(editingId).items.filter((_,j)=>j!==n)})}>×</button></div>)}</div><button type="button" className="btn btn-ghost" disabled={cardById(editingId).items.length>=30} onClick={()=>patchCard(editingId,{items:[...cardById(editingId).items,{food_id:foods[0].id,grams:50}]})}>+ Add ingredient</button></>}<div className="launch-actions"><button type="submit" className="btn btn-primary" disabled={busy}>Save meal</button><button type="button" className="btn btn-secondary" disabled={busy||!sync.online} onClick={saveFavourite}>★ Save favourite</button>{!cardById(editingId).manual&&<button type="button" className="btn btn-secondary" disabled={busy} onClick={saveMeal}>Save as template</button>}<button type="button" className="btn btn-ghost" disabled={busy} onClick={()=>setEditingId(null)}>Cancel</button></div></form></>
      :<><h2>Meal builder</h2><p className="subtle">Build each meal as a card, then tick it when you've eaten it. Tap edit to change a card.</p><div className="meal-cards" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:10}}>{cards.map(card=><article key={card.id} style={{position:'relative',border:'1px solid var(--border)',borderRadius:14,padding:14,display:'flex',flexDirection:'column',gap:8}}><span className="nutrition-eyebrow">{card.slot}</span><strong>{card.name||'New meal'}</strong>{card.name.trim()&&<p className="subtle" style={{margin:0}}>{cardKcal(card)}</p>}<div style={{display:'flex',gap:6,flexWrap:'wrap'}}><button type="button" className="btn btn-ghost" onClick={()=>setEditingId(card.id)}>Edit</button>{!card.eaten&&<button type="button" className="btn btn-primary" disabled={busy} onClick={()=>toggleEaten(card)}>Log</button>}</div>{cards.length>4&&<button type="button" className="btn btn-ghost" onClick={()=>removeCard(card.id)}>Remove</button>}{card.eaten&&<div style={{position:'absolute',inset:0,background:'rgba(16,185,129,0.22)',borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',zIndex:1}}><span style={{fontSize:44,color:'#10b981',lineHeight:1}}>✓</span><button type="button" className="btn btn-ghost" onClick={()=>toggleEaten(card)} aria-label="Unlog this meal" style={{position:'absolute',top:6,right:6,minHeight:36,width:36,padding:0,fontSize:16}}>✕</button></div>}</article>)}</div><button type="button" className="btn btn-ghost" onClick={addCard}>+ Add extra meal</button><button type="button" className="btn btn-secondary btn-block" style={{ marginTop: 10 }} disabled={photoBusy} onClick={()=>photoInput.current?.click()}><span aria-hidden="true">📷</span> Snap your meal</button><label style={{marginTop:12}}>Start from a preset or saved meal<select value="" disabled={busy} onChange={e=>{const m=[...RECIPES,...saved].find(m=>m.id===e.target.value);if(m)choose(m);}}><option value="">Choose a meal…</option>{SLOTS.map(slot=><optgroup key={slot} label={`${slot[0].toUpperCase()+slot.slice(1)} · ${presets.filter(m=>m.slot===slot).length} options`}>{presets.filter(m=>m.slot===slot).map(m=><option value={m.id} key={m.id}>{m.name}</option>)}</optgroup>)}<optgroup label="My saved meals">{saved.map(m=><option value={m.id} key={m.id}>{m.name}</option>)}</optgroup></select></label></>}
      {saved.length>0&&<details><summary>Manage saved meals · {saved.length}</summary>{saved.map(m=><div className="nutrition-log" key={m.id}><span>{m.name}</span><button className="btn btn-ghost" disabled={busy} onClick={()=>action(async()=>{const {error}=await supabase.from('saved_meals').delete().eq('id',m.id).eq('user_id',userId);if(error)throw Error('Could not remove template.');setSaved(v=>v.filter(s=>s.id!==m.id));})}>Remove template</button></div>)}</details>}
    </section>}
    {show('diary')&&<section className="mf-card"><h2>Food diary <span aria-hidden="true" style={{color:cards.some(c=>c.eaten)?'#10b981':cards.some(c=>c.name.trim())?'#f59e0b':'#ef4444'}}>●</span></h2>{sync.pending.filter(e=>e.kind==='food'&&e.payload.day===day).map(e=><div className="nutrition-log pending-food" key={e.id}><strong>{e.payload.name}</strong><span>Saved on device · {e.status==='conflict'?'review conflict':'not yet in totals'}</span></div>)}{entries.length===0?<p className="subtle">Nothing logged for this day.</p>:entries.map(e=><div className="nutrition-log" key={e.id}><div><strong>{e.label||'Food'}</strong><p className="subtle">{e.meal_slot||'Food'} · {format(Math.abs(e.kcal))} kcal</p></div><div className="launch-actions"><button className="btn btn-ghost" disabled={busy} onClick={()=>edit(e)}>Edit</button><button className="btn btn-ghost" disabled={busy} onClick={()=>removeFood(e)}>Remove</button></div></div>)}
      <button type="button" className="btn btn-block" style={{background:dayData?.complete?'#10b981':'#ef4444',color:'#fff'}} disabled={busy||entries.length===0||sync.pending.some(e=>e.kind==='food'&&e.payload.day===day)} onClick={()=>{const complete=!dayData?.complete;const previous=dayData?.complete||false;setDays(v=>v.map(d=>d.day===day?{...d,complete}:d));action(async()=>{const {error}=await supabase.from('nutrition_day_status').upsert({user_id:userId,day,complete},{onConflict:'user_id,day'});if(error){setDays(v=>v.map(d=>d.day===day?{...d,complete:previous}:d));throw Error('Could not update day status.');}await refresh();});}}>Log and save</button>
    </section>}

    {section==='weight'&&<section className="mf-card"><h2>Weight check-ins</h2><p className="subtle">Follow the trend over several weeks. A check-in does not automatically change your calorie guide.</p><form className="nutrition-form" onSubmit={e=>{e.preventDefault();action(async()=>{const weight=Number(weighIn);if(!Number.isFinite(weight)||weight<35||weight>300)throw Error('Enter a weight between 35 and 300 kg.');const {error}=await supabase.from('body_metrics').upsert({client_id:userId,metric_date:day,weight_kg:weight},{onConflict:'client_id,metric_date'});if(error)throw Error('Could not save your check-in.');setWeights(v=>[{metric_date:day,weight_kg:weight},...v.filter(w=>w.metric_date!==day)].sort((a,b)=>b.metric_date.localeCompare(a.metric_date)).slice(0,12));setWeighIn('');setNotice('Weight check-in saved. Update your current weight in Edit goals when you want to recalculate the guide.');});}}><label>Weight on {day} · kg<input type="number" inputMode="decimal" min="35" max="300" step="0.1" required value={weighIn} onChange={e=>setWeighIn(e.target.value)}/></label><button className="btn btn-secondary" disabled={busy}>Save weight check-in</button></form><details><summary>Recent check-ins · {weights.length}</summary>{weights.map(w=><div className="nutrition-log" key={w.metric_date}><span>{w.metric_date}</span><strong>{w.weight_kg} kg</strong></div>)}</details></section>}
    {section==='sources'&&<section className="mf-card nutrition-sources"><h2>How the estimates work & food sources</h2><p>GymIQ uses a general resting-energy equation, your non-gym activity and an estimated net gym contribution. Recorded sessions use the last 28 days and exclude cancelled or implausibly long sessions. These estimates are refreshed when you save goals; workout calories are not added again as food credits.</p><p>A 30-day weight-change model uses 7,700 kcal per kg. Real changes are not linear. The planner caps its estimated deficit at 500 kcal/day, 25% of maintenance, and a floor of the higher of estimated resting needs or 1,500 kcal/day. These are product guardrails, not a guarantee that a diet is appropriate for you.</p><p>Food values come from <a href="https://fdc.nal.usda.gov/download-datasets/" target="_blank" rel="noreferrer">USDA FoodData Central SR Legacy</a>. Actual brands, portions and cooking methods vary. Use packaging values for unlisted foods. Presets follow everyday balanced-meal patterns, not a clinically approved diet.</p><p><a href="https://pacompendium.com/conditioning-exercise/" target="_blank" rel="noreferrer">Activity estimate source</a> · <a href="https://www.canada.ca/en/health-canada/services/food-guide/eating-support/cooking/make-healthy-meals-plate.html" target="_blank" rel="noreferrer">Balanced meal guidance</a></p></section>}
    {section==='insights'&&<Suspense fallback={<p role="status">Opening insights…</p>}><AiReviewCard domain="nutrition"/></Suspense>}
    <input ref={photoInput} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={onPhotoFile} />
    <dialog ref={goalDialog} className="session-discard-dialog" aria-labelledby="goal-prompt-title" onCancel={()=>setGoalDismissed(true)}>
      <h2 id="goal-prompt-title">Set your monthly goal</h2>
      <p>Please set your monthly goal before you use the Calorie Bank. Your goal gives the planner a calorie target for your meal plan.</p>
      <div className="launch-actions">
        <button type="button" className="btn btn-primary" onClick={()=>{goalDialog.current?.close();onSectionChange('goals');}}>Set monthly goal</button>
        <button type="button" className="btn btn-ghost" onClick={()=>{goalDialog.current?.close();setGoalDismissed(true);}}>Not now</button>
      </div>
    </dialog>
  </div>;
}
