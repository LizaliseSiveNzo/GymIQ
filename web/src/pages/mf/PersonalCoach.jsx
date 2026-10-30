import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import TabShell from '../../shell/TabShell.jsx';
import {useAuth} from '../../context/AuthContext.jsx';
import {supabase} from '../../lib/supabaseClient.js';
import foods from '../../../../supabase/functions/_shared/nutrition/foods.json';
import {speechRecognitionClass,startCoachDictation} from '../../lib/coachVoice.js';
import './personalCoach.css';

const toggle=(values,id)=>values.includes(id)?values.filter(x=>x!==id):[...values,id];
async function invoke(body){
 const {data,error}=await supabase.functions.invoke('gymiq-coach',{body});
 if(error){let message;try{message=(await error.context.json()).error;}catch{/* network error */}throw Error(message||'Could not reach your coach. Please try again.');}
 return data;
}
function MealPreview({meal,showName=true}){
 return <div className="coach-meal">{showName?<h4>{meal.slot} · {meal.name}</h4>:<p className="coach-role">{meal.slot}</p>}<p>{Math.round(meal.kcal)} kcal · {Math.round(meal.protein)} g protein · {Math.round(meal.carbs)} g carbs · {Math.round(meal.fat)} g fat</p><ul>{meal.items.map(i=><li key={i.food_id}>{i.grams} g {foods.find(f=>f.id===i.food_id)?.name}</li>)}</ul><p>{meal.preparation}</p></div>;
}
function Proposal({action,busy,onAction}){
 const {payload:p,kind}=action;
 return <article className="coach-proposal"><div className="section-heading"><h3>{kind==='workout'?p.name:kind==='meal_plan'?'Your custom day':p.name}</h3><span className="badge badge-neutral">{action.status}</span></div>
  {kind==='workout'?<><p>{p.generated.daysPerWeek} training days · {7-p.generated.daysPerWeek} rest days · {p.generated.sessionMinutes} min/session</p><details><summary>Review every workout</summary>{p.generated.days.map(d=><div key={d.label}><h4>{d.label} · {d.name}</h4><ul>{d.exercises.map(e=><li key={e.exerciseId}>{e.name} · {e.sets} × {e.repMin}–{e.repMax} · {e.restSeconds}s rest</li>)}</ul></div>)}</details><p className="subtle">Replaces your active programme. Completed workouts and PRs stay in your history. Session load defaults remain yours to review.</p></>:kind==='meal_plan'?<><p>{p.day} · {Math.round(p.meals.reduce((n,m)=>n+m.kcal,0))} kcal · guide {p.target} kcal</p><details><summary>Review ingredients & portions</summary>{p.meals.map(m=><MealPreview key={m.slot} meal={m}/>)}</details><p className="subtle">Replaces this day’s plan. Meals count as intake only when logged.</p></>:<><MealPreview meal={p} showName={false}/><p className="subtle">Saves to your meals in Meal builder. Does not log food.</p></>}
  {action.status==='draft'&&<div className="coach-actions"><button className="btn btn-primary" disabled={busy} onClick={()=>onAction(action,false)}>{kind==='workout'?'Apply programme':kind==='meal_plan'?'Apply daily plan':'Save meal'}</button><button className="btn btn-secondary" disabled={busy} onClick={()=>onAction(action,true)}>Discard</button></div>}
  {action.status==='applied'&&<Link className="btn btn-secondary" to={kind==='workout'?'/workout':`/bank?section=${kind==='meal_plan'?'plan':'builder'}`}>{kind==='workout'?'Open training':'Open Calorie Bank'} ↗</Link>}
 </article>;
}
export default function PersonalCoach(){
 const {profile}=useAuth();
 const [access,setAccess]=useState(null),[equipment,setEquipment]=useState([]),[gyms,setGyms]=useState([]),[gymEquipment,setGymEquipment]=useState([]);
 const [kitchen,setKitchen]=useState({pantry:[],equipment:[]}),[savedKitchen,setSavedKitchen]=useState(null);
 const [turns,setTurns]=useState([]),[proposals,setProposals]=useState([]),[message,setMessage]=useState('');
 const [consent,setConsent]=useState(false),[voiceConsent,setVoiceConsent]=useState(false),[listening,setListening]=useState(false);
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const voice=useRef(null),request=useRef(null),loadedUser=useRef(null);
 const dirty=JSON.stringify(kitchen)!==JSON.stringify(savedKitchen);
 async function refresh(){
  const results=await Promise.all([
   supabase.from('coach_settings').select('pantry,equipment').eq('user_id',profile.id).maybeSingle(),
   supabase.from('equipment_items').select('id,name').order('sort_order'),
   supabase.from('gym_profiles').select('id,name').eq('user_id',profile.id),
   supabase.from('gym_profile_equipment').select('profile_id,equipment_id,selected').eq('selected',true),
   supabase.from('coach_turns').select('id,prompt,reply,status,created_at').eq('user_id',profile.id).order('created_at',{ascending:false}).limit(20),
   supabase.from('coach_actions').select('*').eq('user_id',profile.id).order('created_at',{ascending:false}).limit(30),
  ]);
  if(results.some(r=>r.error))throw Error('Could not load your coach. Please refresh.');
  const [settings,items,profiles,selections,history,actions]=results.map(r=>r.data);
  if(loadedUser.current!==profile.id){const value=settings||{pantry:[],equipment:[]};setKitchen(value);setSavedKitchen(value);loadedUser.current=profile.id;}
  setEquipment(items);setGyms(profiles);setGymEquipment(selections);setTurns(history.slice().reverse());setProposals(actions);
 }
 useEffect(()=>{let mounted=true;loadedUser.current=null;
  invoke({action:'status'}).then(async result=>{if(mounted){setAccess(result);await refresh();}}).catch(e=>{if(mounted){setAccess({enabled:false});setError(e.message);}});
  return()=>{mounted=false;};
 // The signed-in profile is the boundary for all coach data.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[profile.id]);
 useEffect(()=>{
  const stop=()=>{voice.current?.abort();voice.current=null;setListening(false);};
  const hidden=()=>{if(document.hidden)stop();};document.addEventListener('visibilitychange',hidden);
  return()=>{document.removeEventListener('visibilitychange',hidden);voice.current?.abort();globalThis.speechSynthesis?.cancel();};
 },[]);
 async function run(key,fn){if(busy)return;setBusy(key);setError('');setNotice('');try{await fn();}catch(e){setError(e.message);}finally{setBusy('');}}
 async function saveKitchen(){await run('settings',async()=>{
  const {error}=await supabase.from('coach_settings').upsert({user_id:profile.id,...kitchen,updated_at:new Date().toISOString()});
  if(error)throw Error('Could not save your ingredients and equipment.');
  setSavedKitchen(structuredClone(kitchen));setNotice('Ingredients and equipment saved.');
 });}
 async function send(event){event.preventDefault();if(!consent||dirty||!message.trim())return;
  await run('chat',async()=>{
   voice.current?.abort();voice.current=null;setListening(false);
   request.current ||= crypto.randomUUID();
   try{await invoke({action:'chat',message:message.trim(),consent:true,request_id:request.current,offset:new Date().getTimezoneOffset()});}catch(e){request.current=null;throw e;}
   setMessage('');request.current=null;await refresh();setNotice('Response ready. Review any proposals below before applying them.');
  });
 }
 async function apply(action,discard){await run(action.id,async()=>{
  const {error}=await supabase.rpc('apply_coach_action',{p_id:action.id,p_discard:discard});
  if(error)throw Error(error.message);
  await refresh();setNotice(discard?'Proposal discarded.':action.kind==='meal'?'Meal saved to Meal builder.':action.kind==='workout'?'Your new programme is ready in Training.':'Daily plan saved to Calorie Bank.');
 });}
 function dictate(){
  if(listening){voice.current?.stop();return;}
  if(!voiceConsent)return;
  try{voice.current=startCoachDictation({onText:text=>{setMessage(previous=>((previous?previous+' ':'')+text).slice(0,2000));request.current=null;},onError:setError,onEnd:()=>{setListening(false);voice.current=null;}});setListening(true);}catch(e){setError(e.message);}
 }
 function readReply(text){if(!globalThis.speechSynthesis)return;globalThis.speechSynthesis.cancel();const speech=new SpeechSynthesisUtterance(text);speech.lang='en-ZA';globalThis.speechSynthesis.speak(speech);}
 return <TabShell title="Your personal coach"><div className="coach-page">
  <p className="subtle">Meals from your kitchen. Training for your equipment. Powered by DeepSeek.</p>
  {error&&<p className="inline-error" role="alert">{error}</p>}{notice&&<p className="coach-notice" role="status">{notice}</p>}
  {!access?<p role="status">Preparing your coach…</p>:!access.enabled?<p className="mf-card">The personal coach is currently available to the owner’s account.</p>:<>
   {!access.configured&&<p className="inline-error">DeepSeek is not configured yet. Add DEEPSEEK_API_KEY in Supabase secrets.</p>}
   <details className="mf-card coach-setup"><summary>My ingredients & equipment · {kitchen.pantry.length} foods, {kitchen.equipment.length} equipment {dirty?'· unsaved':''}</summary>
    <p className="subtle">Select what you have. Food names specify raw, cooked or dry weights. This is an availability list; stock quantities are not deducted.</p>
    <fieldset disabled={!!busy}><legend>Available ingredients</legend><div className="coach-choice-grid">{foods.map(f=><label key={f.id}><input type="checkbox" checked={kitchen.pantry.includes(f.id)} onChange={()=>setKitchen(k=>({...k,pantry:toggle(k.pantry,f.id)}))}/>{f.name}</label>)}</div></fieldset>
    {gyms.length>0&&<label className="coach-gym">Use equipment from a saved gym<select defaultValue="" disabled={!!busy} onChange={e=>{if(e.target.value)setKitchen(k=>({...k,equipment:gymEquipment.filter(x=>x.profile_id===e.target.value).map(x=>x.equipment_id)}));}}><option value="">Choose a gym</option>{gyms.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>}
    <fieldset disabled={!!busy}><legend>Available equipment</legend><p className="subtle">Bodyweight exercises are always available. Select any additional equipment you have.</p><div className="coach-choice-grid">{equipment.filter(e=>e.id!=='bodyweight').map(e=><label key={e.id}><input type="checkbox" checked={kitchen.equipment.includes(e.id)} onChange={()=>setKitchen(k=>({...k,equipment:toggle(k.equipment,e.id)}))}/>{e.name}</label>)}</div></fieldset>
    <button className="btn btn-primary" disabled={!!busy||!dirty} onClick={saveKitchen}>Save ingredients & equipment</button>
   </details>
   <section className="mf-card coach-chat"><h2>Talk to your coach</h2>
    <label className="coach-check"><input type="checkbox" checked={consent} disabled={!!busy} onChange={e=>setConsent(e.target.checked)}/><span>Share my messages, recent coach conversation, selected ingredients/equipment, saved calorie guide, diet/exclusions, current programme and recent performed sets with DeepSeek. My name, email and measurements are omitted. <Link to="/privacy">How data is used</Link></span></label>
    <p className="subtle">Your proposals need your approval. Existing food logs, completed sets and PRs are protected. Personal allowance: 50 requests per UTC day.</p>
    <form onSubmit={send}><label htmlFor="coach-message">What would you like to change?</label><textarea id="coach-message" maxLength={2000} rows={4} value={message} disabled={!!busy} placeholder="Build a lunch using what I have, or make a three-day programme for my equipment…" onChange={e=>{setMessage(e.target.value);request.current=null;}}/>
     <div className="coach-actions"><button className="btn btn-primary" disabled={!!busy||!consent||dirty||!message.trim()||!access.configured}>{busy==='chat'?'Coach is preparing…':'Send to DeepSeek'}</button>{speechRecognitionClass()&&<button type="button" className="btn btn-secondary" disabled={!!busy||!voiceConsent} onClick={dictate}>{listening?'Stop listening':'🎙 Speak'}</button>}</div>
     {dirty&&<p className="subtle">Save your ingredient and equipment changes before sending.</p>}
     {speechRecognitionClass()?<label className="coach-check"><input type="checkbox" checked={voiceConsent} disabled={listening} onChange={e=>setVoiceConsent(e.target.checked)}/><span>Enable voice input. My browser may send microphone audio to its speech service. GymIQ receives the transcript, which I can edit before sending.</span></label>:<p className="subtle">Voice input is unavailable in this browser. You can type all the same requests.</p>}
     {listening&&<p role="status">Listening… Your transcript will appear above. Review it before sending.</p>}
    </form>
   </section>
   <section className="coach-conversation" aria-label="Coach conversation" aria-busy={busy==='chat'}>{turns.map(turn=><article className="mf-card" key={turn.id}><p className="coach-role">You</p><p className="coach-text">{turn.prompt}</p>{turn.reply?<><p className="coach-role">DeepSeek</p><p className="coach-text">{turn.reply}</p>{globalThis.speechSynthesis&&<button className="btn btn-ghost" onClick={()=>readReply(turn.reply)}>Read aloud</button>}</>:<p className="subtle">{turn.status==='error'?'This request could not be completed. Send a new message to try again.':'This request is being prepared. Refresh shortly.'}</p>}{proposals.filter(p=>p.turn_id===turn.id).map(p=><Proposal key={p.id} action={p} busy={!!busy} onAction={apply}/>)}</article>)}</section>
  </>}
 </div></TabShell>;
}
