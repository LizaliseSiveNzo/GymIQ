import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import TabShell from '../../shell/TabShell.jsx';
import {useAuth} from '../../context/AuthContext.jsx';
import {supabase} from '../../lib/supabaseClient.js';
import foods from '../../../../supabase/functions/_shared/nutrition/foods.json';
import {speechRecognitionClass,startCoachDictation,coachVoices,chooseCoachVoice} from '../../lib/coachVoice.js';
import {createCoachAudio} from '../../lib/coachAudio.js';
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
 const [listening,setListening]=useState(false),[readingId,setReadingId]=useState(null);
 const [voices,setVoices]=useState([]),[voiceUri,setVoiceUri]=useState('microsoft-cloud');
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const voice=useRef(null),speech=useRef(null),conversation=useRef(null),request=useRef(null),loadedUser=useRef(null);
 const cloudAudio=useRef(null),readingVersion=useRef(0);
 const dirty=JSON.stringify(kitchen)!==JSON.stringify(savedKitchen);
 const selectedVoice=chooseCoachVoice(voices);
 useEffect(()=>{
  readingVersion.current++;cloudAudio.current?.stop();cloudAudio.current=null;setReadingId(null);
  try{setVoiceUri(localStorage.getItem(`gymiq_coach_voice_${profile.id}`)??'microsoft-cloud');}catch{/* Device preference is optional. */}
  const synthesis=globalThis.speechSynthesis,update=()=>setVoices(coachVoices(synthesis));
  update();synthesis?.addEventListener?.('voiceschanged',update);
  return()=>synthesis?.removeEventListener?.('voiceschanged',update);
 },[profile.id]);
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
  const hidden=()=>{if(document.hidden){stop();stopReading();}};document.addEventListener('visibilitychange',hidden);
  return()=>{document.removeEventListener('visibilitychange',hidden);voice.current?.abort();readingVersion.current++;cloudAudio.current?.stop();speech.current=null;globalThis.speechSynthesis?.cancel();};
 },[]);
 async function run(key,fn){if(busy)return;setBusy(key);setError('');setNotice('');try{await fn();}catch(e){setError(e.message);}finally{setBusy('');}}
 async function saveKitchen(){await run('settings',async()=>{
  const {error}=await supabase.from('coach_settings').upsert({user_id:profile.id,...kitchen,updated_at:new Date().toISOString()});
  if(error)throw Error('Could not save your ingredients and equipment.');
  setSavedKitchen(structuredClone(kitchen));setNotice('Ingredients and equipment saved.');
 });}
 async function send(event){event.preventDefault();if(busy||dirty||!message.trim()||!access?.configured)return;
  await run('chat',async()=>{
   voice.current?.abort();voice.current=null;setListening(false);stopReading();
   request.current ||= crypto.randomUUID();
   try{await invoke({action:'chat',message:message.trim(),consent:true,request_id:request.current,offset:new Date().getTimezoneOffset()});}catch(e){request.current=null;throw e;}
   setMessage('');request.current=null;await refresh();
  });
 }
 async function apply(action,discard){await run(action.id,async()=>{
  const {error}=await supabase.rpc('apply_coach_action',{p_id:action.id,p_discard:discard});
  if(error)throw Error(error.message);
  await refresh();setNotice(discard?'Proposal discarded.':action.kind==='meal'?'Meal saved to Meal builder.':action.kind==='workout'?'Your new programme is ready in Training.':'Daily plan saved to Calorie Bank.');
 });}
 function dictate(){
  if(listening){voice.current?.stop();return;}
  stopReading();
  try{voice.current=startCoachDictation({onText:text=>{setMessage(previous=>((previous?previous+' ':'')+text).slice(0,2000));request.current=null;},onError:setError,onEnd:()=>{setListening(false);voice.current=null;}});setListening(true);}catch(e){setError(e.message);}
 }
 function stopReading(){readingVersion.current++;cloudAudio.current?.stop();speech.current=null;globalThis.speechSynthesis?.cancel();setReadingId(null);}
 async function readReply(id,text){
  stopReading();const version=readingVersion.current;
  if(voiceUri==='microsoft-cloud'&&navigator.onLine){
   setReadingId(id);
   cloudAudio.current ||= createCoachAudio({load:async(turnId,signal)=>{
    const {data,error}=await supabase.functions.invoke('gymiq-speech',{body:{turn_id:turnId},signal});
    if(error)throw Error('Microsoft speech is unavailable.');return data;
   }});
   try{await cloudAudio.current.read(id,error=>{if(readingVersion.current===version){stopReading();if(error)setError(error.message);}});return;}
   catch(error){
    if(readingVersion.current!==version)return;
    if(error.name==='NotAllowedError'){setReadingId(null);setNotice('Audio ready. Tap Read aloud again to play.');return;}
    setNotice('Microsoft voice is unavailable. Using your device voice.');
   }
  }
  if(readingVersion.current!==version)return;
  if(!globalThis.speechSynthesis||!globalThis.SpeechSynthesisUtterance){setReadingId(null);setError('Audio is unavailable. Please try again online.');return;}

  const utterance=new SpeechSynthesisUtterance(text),chosen=chooseCoachVoice(coachVoices(),voiceUri);
  if(chosen)utterance.voice=chosen;utterance.lang=chosen?.lang||'en-ZA';speech.current=utterance;
  const ended=()=>{if(speech.current===utterance){speech.current=null;setReadingId(null);}};
  utterance.onend=ended;utterance.onerror=ended;setReadingId(id);
  try{globalThis.speechSynthesis.speak(utterance);}catch{ended();setError('Read aloud is unavailable. Please try again.');}
 }
 useEffect(()=>{const panel=conversation.current;if(panel)panel.scrollTop=panel.scrollHeight;},[turns,busy]);
 function fillPrompt(text){setMessage(text);request.current=null;document.getElementById('coach-message')?.focus();}

 return <TabShell title="AI coach" showKicker={false}><div className="coach-page">
  {!access?<p role="status">Opening your coach…</p>:!access.enabled?<p className="mf-card">Your personal coach isn’t available for this account.</p>:<>
   <div className="coach-toolbar"><span className="coach-model"><span aria-hidden="true">✦</span> DeepSeek</span>{readingId&&<button type="button" className="btn btn-secondary coach-stop" onClick={stopReading}>■ Stop reading</button>}</div>
   <details className="coach-setup"><summary>Ingredients & equipment · {kitchen.pantry.length} foods, {kitchen.equipment.length} equipment {dirty?'· unsaved':''}</summary>

    <fieldset disabled={!!busy}><legend>Available ingredients</legend><div className="coach-choice-grid">{foods.map(f=><label key={f.id}><input type="checkbox" checked={kitchen.pantry.includes(f.id)} onChange={()=>setKitchen(k=>({...k,pantry:toggle(k.pantry,f.id)}))}/>{f.name}</label>)}</div></fieldset>
    {gyms.length>0&&<label className="coach-gym">Use equipment from a saved gym<select defaultValue="" disabled={!!busy} onChange={e=>{if(e.target.value)setKitchen(k=>({...k,equipment:gymEquipment.filter(x=>x.profile_id===e.target.value).map(x=>x.equipment_id)}));}}><option value="">Choose a gym</option>{gyms.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>}
    <fieldset disabled={!!busy}><legend>Available equipment</legend><div className="coach-choice-grid">{equipment.filter(e=>e.id!=='bodyweight').map(e=><label key={e.id}><input type="checkbox" checked={kitchen.equipment.includes(e.id)} onChange={()=>setKitchen(k=>({...k,equipment:toggle(k.equipment,e.id)}))}/>{e.name}</label>)}</div></fieldset>
    <button className="btn btn-primary" disabled={!!busy||!dirty} onClick={saveKitchen}>Save ingredients & equipment</button>
    {<div className="coach-voice-setting"><label htmlFor="coach-voice">Reading voice</label><select id="coach-voice" value={voiceUri==='microsoft-cloud'||voices.some(v=>v.voiceURI===voiceUri)?voiceUri:''} onChange={e=>{stopReading();setVoiceUri(e.target.value);try{localStorage.setItem(`gymiq_coach_voice_${profile.id}`,e.target.value);}catch{/* Optional device preference. */}}}><option value="microsoft-cloud">Microsoft Leah · South Africa (online)</option><option value="">Device · {selectedVoice?.name||'default'}</option>{voices.map(v=><option key={v.voiceURI} value={v.voiceURI}>{v.name} · {v.lang}</option>)}</select></div>}
   </details>

   <div className="coach-workspace">
    <section ref={conversation} className="coach-conversation" aria-label="Coach conversation" aria-busy={busy==='chat'}>
     {!turns.length&&<div className="coach-welcome"><span className="coach-welcome-mark" aria-hidden="true">✦</span><h2>What are we working on?</h2><p>Meals, training, or your next step.</p><div className="coach-starters">{['Build a meal with my ingredients','Plan workouts for my equipment','Help me adjust my meal plan'].map(text=><button type="button" key={text} onClick={()=>fillPrompt(text)}>{text}<span aria-hidden="true">↗</span></button>)}</div></div>}
     {turns.map(turn=><article className="coach-turn" key={turn.id}>
      <div className="coach-user-message"><span className="coach-visually-hidden">You</span><p className="coach-text">{turn.prompt}</p></div>
      <div className="coach-assistant-message"><div className="coach-assistant-label"><span aria-hidden="true">✦</span> Coach</div>
       {turn.reply?<><p className="coach-text">{turn.reply}</p>{(globalThis.Audio||globalThis.speechSynthesis)&&<button type="button" className="coach-read" aria-label={readingId===turn.id?'Stop reading reply':'Read reply aloud'} onClick={()=>readingId===turn.id?stopReading():readReply(turn.id,turn.reply)}>{readingId===turn.id?'■ Stop reading':'◖ Read aloud'}</button>}</>:<p className="subtle">{turn.status==='error'?'Couldn’t complete this request. Please try again.':'Preparing your reply…'}</p>}
       {proposals.filter(p=>p.turn_id===turn.id).map(p=><Proposal key={p.id} action={p} busy={!!busy} onAction={apply}/>)}
      </div>
     </article>)}
     {busy==='chat'&&message.trim()&&<div className="coach-user-message"><p className="coach-text">{message}</p></div>}
     {busy==='chat'&&<div className="coach-thinking" role="status"><span aria-hidden="true">✦</span> Thinking…</div>}
    </section>
    {error&&<p className="inline-error coach-feedback" role="alert">{error}</p>}{notice&&<p className="coach-notice coach-feedback" role="status">{notice}</p>}
    {!access.configured&&<p className="inline-error coach-feedback">Your coach is unavailable right now.</p>}
    <form className="coach-composer" onSubmit={send}>
     <label className="coach-visually-hidden" htmlFor="coach-message">Message your coach</label>
     <textarea id="coach-message" maxLength={2000} rows={2} value={message} disabled={!!busy} placeholder="Message your coach…" onChange={e=>{setMessage(e.target.value);request.current=null;}} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();e.currentTarget.form.requestSubmit();}}}/>
     <div className="coach-composer-actions"><span className="coach-composer-hint">{listening?'Listening…':dirty?'Save your ingredients & equipment first.':''}</span><div>{speechRecognitionClass()&&<button type="button" className={`coach-mic ${listening?'is-listening':''}`} disabled={!!busy} onClick={dictate} aria-label={listening?'Stop listening':'Speak your message'}>{listening?'■ Stop':'🎙 Speak'}</button>}<button type="submit" className="coach-send" aria-label="Send message" disabled={!!busy||dirty||!message.trim()||!access.configured}>{busy==='chat'?'…':'↑'}</button></div></div>
    </form>
    <div className="coach-footer"><Link to="/privacy">Privacy</Link></div>
   </div>
  </>}
 </div></TabShell>;
}
