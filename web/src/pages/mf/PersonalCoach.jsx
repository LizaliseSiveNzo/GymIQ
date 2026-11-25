import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import TabShell from '../../shell/TabShell.jsx';
import {useAuth} from '../../context/AuthContext.jsx';
import {supabase} from '../../lib/supabaseClient.js';
import foods from '../../../../supabase/functions/_shared/nutrition/foods.json';
import {speechRecognitionClass,startCoachDictation,coachVoices,chooseCoachVoice} from '../../lib/coachVoice.js';
import {createCoachAudio} from '../../lib/coachAudio.js';
import {readView,saveView} from '../../lib/deviceCache.js';
import {getAiConsent,setAiConsent} from '../../lib/aiConsent.js';
import {reportClientIssue} from '../../lib/clientIssues.js';
import NuanceVoiceCoach from '../../components/ui/NuanceVoiceCoach.jsx';
import './personalCoach.css';

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
  {kind==='workout'?<><p>{p.generated.daysPerWeek} training days · {7-p.generated.daysPerWeek} rest days · {p.generated.sessionMinutes} min/session</p><details><summary>Review every workout</summary>{p.generated.days.map(d=><div key={d.label}><h4>{d.label} · {d.name}</h4><ul>{d.exercises.map(e=><li key={e.exerciseId}>{e.name} · {e.sets} × {e.repMin}–{e.repMax} · {e.restSeconds}s rest</li>)}</ul></div>)}</details><p className="subtle">Replaces your active programme. Completed workouts and PRs stay in your history. Session load defaults remain yours to review.</p></>:kind==='meal_plan'?<><p>{p.day} · {Math.round(p.meals.reduce((n,m)=>n+m.kcal,0))} kcal · guide {p.target} kcal</p><details><summary>Review ingredients & portions</summary>{p.meals.map(m=><MealPreview key={m.slot} meal={m}/>)}</details><p className="subtle">Replaces this day’s plan. Meals count as intake only when logged.</p></>:kind==='log_food'?<><MealPreview meal={p} showName={false}/><p className="subtle">Logs this to your food diary for {p.day}.</p></>:<><MealPreview meal={p} showName={false}/><p className="subtle">Saves to your meals in Meal builder. Does not log food.</p></>}
  {action.status==='draft'&&<div className="coach-actions"><button className="btn btn-primary" disabled={busy} onClick={()=>onAction(action,false)}>{kind==='workout'?'Apply programme':kind==='meal_plan'?'Apply daily plan':kind==='log_food'?'Log to diary':'Save meal'}</button><button className="btn btn-secondary" disabled={busy} onClick={()=>onAction(action,true)}>Discard</button></div>}
  {action.status==='applied'&&<Link className="btn btn-secondary" to={kind==='workout'?'/workout':`/bank?section=${kind==='meal_plan'?'plan':kind==='log_food'?'diary':'builder'}`}>{kind==='workout'?'Open training':'Open Calorie Bank'} ↗</Link>}
 </article>;
}
const gearIcon=<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>;
const micIcon=<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" x2="12" y1="19" y2="22"/></svg>;
const camIcon=<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>;
const sendIcon=<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>;
export default function PersonalCoach(){
 const {profile}=useAuth();
 const [access,setAccess]=useState(null);
 const [turns,setTurns]=useState([]),[proposals,setProposals]=useState([]),[message,setMessage]=useState('');
 const [listening,setListening]=useState(false),[readingId,setReadingId]=useState(null);
 const [voices,setVoices]=useState([]),[voiceUri,setVoiceUri]=useState('');
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[settingsOpen,setSettingsOpen]=useState(false),[loadingSpeech,setLoadingSpeech]=useState(null),[voiceOpen,setVoiceOpen]=useState(false);
 const voice=useRef(null),speech=useRef(null),conversation=useRef(null),request=useRef(null),settingsDialog=useRef(null);
 const cloudAudio=useRef(null),readingVersion=useRef(0);
 const selectedVoice=chooseCoachVoice(voices);
 useEffect(()=>{
  readingVersion.current++;cloudAudio.current?.stop();cloudAudio.current=null;setReadingId(null);
  try{setVoiceUri(localStorage.getItem(`gymiq_coach_voice_${profile.id}`)??'gemini');}catch{/* Device preference is optional. */}
  const synthesis=globalThis.speechSynthesis,update=()=>setVoices(coachVoices(synthesis));
  update();synthesis?.addEventListener?.('voiceschanged',update);
  return()=>synthesis?.removeEventListener?.('voiceschanged',update);
 },[profile.id]);
 useEffect(()=>{if(settingsOpen&&settingsDialog.current&&!settingsDialog.current.open)settingsDialog.current.showModal();else if(!settingsOpen&&settingsDialog.current?.open)settingsDialog.current.close();},[settingsOpen]);
 useEffect(()=>{if(voiceUri==='gemini')cloudAudio.current ||= createCoachAudio({load:loadSpeech});},[voiceUri,profile.id]);
 useEffect(()=>{if(voiceUri!=='gemini'){setLoadingSpeech(null);return;}const last=turns.filter(t=>t.status==='done'&&t.reply).slice(-1)[0];if(!last){setLoadingSpeech(null);return;}setLoadingSpeech(last.id);cloudAudio.current?.prefetch?.(last.id,()=>setLoadingSpeech(cur=>cur===last.id?null:cur));},[turns,voiceUri]);
 async function refresh(){
  const results=await Promise.all([
   supabase.from('coach_turns').select('id,prompt,reply,status,created_at').eq('user_id',profile.id).order('created_at',{ascending:false}).limit(20),
   supabase.from('coach_actions').select('*').eq('user_id',profile.id).order('created_at',{ascending:false}).limit(30),
  ]);
  if(results.some(r=>r.error))throw Error('Could not load your coach. Please refresh.');
  const [history,actions]=results.map(r=>r.data);
  const turns=history.slice().reverse();
  setTurns(turns);setProposals(actions);
  saveView(profile.id,'coach-turns',{turns,proposals:actions});
 }
 useEffect(()=>{let mounted=true;
  const cachedAccess=readView(profile.id,'coach-access'),cachedTurns=readView(profile.id,'coach-turns');
  if(cachedAccess?.data)setAccess(cachedAccess.data);
  if(cachedTurns?.data){setTurns(cachedTurns.data.turns||[]);setProposals(cachedTurns.data.proposals||[]);}
  invoke({action:'status'}).then(async result=>{if(mounted){setAccess(result);saveView(profile.id,'coach-access',result);await refresh();}}).catch(e=>{if(mounted){setAccess({enabled:false});setError(e.message);}});
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
 async function send(event){event.preventDefault();if(busy||!message.trim()||!access?.configured)return;
  if(!getAiConsent()){setError('AI sharing is turned off. Enable it in Coach settings (⚙).');return;}
  await run('chat',async()=>{
   voice.current?.abort();voice.current=null;setListening(false);stopReading();
   request.current ||= crypto.randomUUID();
   try{await invoke({action:'chat',message:message.trim(),consent:getAiConsent(),request_id:request.current,offset:new Date().getTimezoneOffset()});}catch(e){request.current=null;throw e;}
   setMessage('');request.current=null;await refresh();
  });
 }
 async function apply(action,discard){await run(action.id,async()=>{
  const {error}=await supabase.rpc('apply_coach_action',{p_id:action.id,p_discard:discard});
  if(error)throw Error(error.message);
  await refresh();setNotice(discard?'Proposal discarded.':action.kind==='meal'?'Meal saved to Meal builder.':action.kind==='log_food'?'Logged to your food diary.':action.kind==='workout'?'Your new programme is ready in Training.':'Daily plan saved to Calorie Bank.');
 });}
 function dictate(){
  if(listening){voice.current?.stop();return;}
  stopReading();
  const base=message;
  try{voice.current=startCoachDictation({onText:live=>{setMessage(((base?base+' ':'')+live).slice(0,2000));request.current=null;},onError:setError,onEnd:()=>{setListening(false);voice.current=null;}});setListening(true);}catch(e){setError(e.message);}
 }
 function stopReading(){readingVersion.current++;cloudAudio.current?.stop();speech.current=null;globalThis.speechSynthesis?.cancel();setReadingId(null);}
 async function loadSpeech(turnId,signal){
  const {data,error}=await supabase.functions.invoke('gymiq-speech',{body:{turn_id:turnId},signal});
  if(error)throw Error('Gemini voice is unavailable.');if(data?.error)throw Error(data.detail?`${data.error} — ${data.detail}`:data.error);return data;
 }
 function speakDevice(text,version,id){
  if(readingVersion.current!==version)return;
  if(!globalThis.speechSynthesis||!globalThis.SpeechSynthesisUtterance){setReadingId(null);setError('Audio is unavailable. Please try again online.');return;}
  const utterance=new SpeechSynthesisUtterance(text),chosen=chooseCoachVoice(coachVoices(),voiceUri);
  if(chosen)utterance.voice=chosen;utterance.lang=chosen?.lang||'en-ZA';speech.current=utterance;
  const ended=()=>{if(speech.current===utterance){speech.current=null;setReadingId(null);}};
  utterance.onend=ended;utterance.onerror=ended;setReadingId(id);
  try{globalThis.speechSynthesis.speak(utterance);}catch{ended();setError('Read aloud is unavailable. Please try again.');}
 }
 async function readReply(id,text){
  stopReading();const version=readingVersion.current;
  const fallback=(error)=>{if(readingVersion.current!==version)return;if(error)reportClientIssue(profile.id,'speech_failed');speakDevice(text,version,id);};
  if(voiceUri==='gemini'&&navigator.onLine){
   setReadingId(id);
   cloudAudio.current ||= createCoachAudio({load:loadSpeech});
   try{await cloudAudio.current.read(id,error=>{if(readingVersion.current===version){if(error)fallback(error);else setReadingId(null);}});return;}
   catch(error){
    if(readingVersion.current!==version)return;
    if(error.name==='NotAllowedError'){setReadingId(null);setNotice('Audio ready. Tap Read aloud again to play.');return;}
    fallback(error);
   }
  }
  speakDevice(text,version,id);
 }
 useEffect(()=>{const panel=conversation.current;if(panel)panel.scrollTop=panel.scrollHeight;},[turns,busy]);
 function fillPrompt(text){setMessage(text);request.current=null;document.getElementById('coach-message')?.focus();}

 return <TabShell title="AI coach" showKicker={false} showCoachFab={false} headerAction={<button type="button" className="coach-settings-btn" onClick={()=>setSettingsOpen(true)} aria-label="Coach settings">{gearIcon}</button>}><div className="coach-page">
  {!access?<p role="status">Opening your coach…</p>:!access.enabled?<p className="mf-card">Your personal coach isn’t available for this account.</p>:<>
   {readingId&&<button type="button" className="btn btn-secondary coach-stop" onClick={stopReading}>■ Stop reading</button>}
   <div className="coach-workspace">
    <section ref={conversation} className="coach-conversation" aria-label="Coach conversation" aria-busy={busy==='chat'}>
     {!turns.length&&<div className="coach-welcome"><span className="coach-welcome-mark" aria-hidden="true">✦</span><h2>What are we working on?</h2><p>Meals, training, or your next step.</p><div className="coach-starters">{['Build a meal with my ingredients','Plan workouts for my equipment','Review my training & food logs'].map(text=><button type="button" key={text} onClick={()=>fillPrompt(text)}>{text}<span aria-hidden="true">↗</span></button>)}</div></div>}
     {turns.map(turn=><article className="coach-turn" key={turn.id}>
      <div className="coach-user-message"><span className="coach-visually-hidden">You</span><p className="coach-text">{turn.prompt}</p></div>
      <div className="coach-assistant-message"><div className="coach-assistant-label"><span aria-hidden="true">✦</span> Coach</div>
       {turn.reply?<><p className="coach-text">{turn.reply}</p>{(globalThis.Audio||globalThis.speechSynthesis)&&<button type="button" className="coach-read" disabled={voiceUri==='gemini'&&loadingSpeech===turn.id} aria-label={readingId===turn.id?'Stop reading reply':'Read reply aloud'} onClick={()=>readingId===turn.id?stopReading():readReply(turn.id,turn.reply)}>{readingId===turn.id?'■ Stop reading':'◖ Read aloud'}</button>}</>:<p className="subtle">{turn.status==='error'?'Couldn’t complete this request. Please try again.':'Preparing your reply…'}</p>}
       {proposals.filter(p=>p.turn_id===turn.id).map(p=><Proposal key={p.id} action={p} busy={!!busy} onAction={apply}/>)}
      </div>
     </article>)}
     {busy==='chat'&&message.trim()&&<div className="coach-user-message"><p className="coach-text">{message}</p></div>}
     {busy==='chat'&&<div className="coach-thinking" role="status"><span aria-hidden="true">✦</span> Thinking…</div>}
    </section>
    {error&&<p className="inline-error coach-feedback" role="alert">{error}</p>}{notice&&<p className="coach-notice coach-feedback" role="status">{notice}</p>}
    {listening&&<p className="coach-listening" role="status">Listening… speak now · tap the mic to stop.</p>}
    {!access.configured&&<p className="inline-error coach-feedback">Your coach is unavailable right now.</p>}
    <form className="coach-composer" onSubmit={send}>
     <button type="button" className="coach-cam" disabled={!!busy} onClick={()=>setVoiceOpen(true)} aria-label="Start video voice coach">{camIcon}</button>
     <label className="coach-visually-hidden" htmlFor="coach-message">Message your coach</label>
     <textarea id="coach-message" maxLength={2000} rows={1} value={message} disabled={!!busy} placeholder="Message your coach" onChange={e=>{setMessage(e.target.value);request.current=null;}} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();e.currentTarget.form.requestSubmit();}}}/>
     {speechRecognitionClass()&&<button type="button" className={`coach-mic ${listening?'is-listening':''}`} disabled={!!busy} onClick={dictate} aria-label={listening?'Stop listening':'Speak your message'}>{micIcon}</button>}
     <button type="submit" className="coach-send" aria-label="Send message" disabled={!!busy||!message.trim()||!access.configured}>{sendIcon}</button>
    </form>
   </div>
   <dialog ref={settingsDialog} className="coach-settings-sheet" aria-label="Coach settings" onCancel={()=>setSettingsOpen(false)}><div className="coach-settings-head"><h2>Coach settings</h2><button type="button" className="btn btn-ghost" onClick={()=>setSettingsOpen(false)} aria-label="Close">✕</button></div><label className="coach-settings-row" htmlFor="coach-voice">Reading voice<select id="coach-voice" value={['','gemini'].includes(voiceUri)||voices.some(v=>v.voiceURI===voiceUri)?voiceUri:'gemini'} onChange={e=>{stopReading();setVoiceUri(e.target.value);try{localStorage.setItem(`gymiq_coach_voice_${profile.id}`,e.target.value);}catch{/* Optional device preference. */}}}><option value="gemini">Gemini (Read aloud)</option><option value="">Device · {selectedVoice?.name||'default'}</option>{voices.map(v=><option key={v.voiceURI} value={v.voiceURI}>{v.name} · {v.lang}</option>)}</select></label><label className="coach-settings-row" style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}><input type="checkbox" defaultChecked={getAiConsent()} onChange={e=>setAiConsent(e.target.checked)} />Share with AI assistants (DeepSeek & Gemini)</label><Link to="/privacy" className="coach-settings-link">Privacy</Link></dialog>
  </>}
 </div><NuanceVoiceCoach open={voiceOpen} onClose={()=>setVoiceOpen(false)} /></TabShell>;
}
