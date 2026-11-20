export function speechRecognitionClass(scope=globalThis) {
  return scope.SpeechRecognition || scope.webkitSpeechRecognition || null;
}
export function coachVoices(synthesis=globalThis.speechSynthesis){
 try{return (synthesis?.getVoices?.()||[]).filter(voice=>/^en(?:[-_]|$)/i.test(voice.lang)).slice().sort((a,b)=>voiceScore(b)-voiceScore(a)||a.name.localeCompare(b.name));}catch{return [];}
}
function voiceScore(voice){
 const microsoft=/microsoft/i.test(voice.name||'');
 return (microsoft?100:0)+(microsoft&&/natural|neural/i.test(voice.name||'')?50:0)+(/^en[-_]ZA$/i.test(voice.lang)?20:0)+(voice.default?1:0);
}
export function chooseCoachVoice(voices,uri=''){
 return voices.find(voice=>voice.voiceURI===uri)||voices.slice().sort((a,b)=>voiceScore(b)-voiceScore(a))[0]||null;
}
export function startCoachDictation({scope=globalThis,onText,onError,onEnd,silenceMs=3000}) {
  const Recognition=speechRecognitionClass(scope);
  if(!Recognition)throw Error('Voice input is unavailable in this browser. Type your message instead.');
  const recognition=new Recognition();
  recognition.lang='en-ZA';recognition.continuous=true;recognition.interimResults=true;
  let finalText='';let silenceTimer=null;let finished=false;
  const clearTimer=()=>{if(silenceTimer){clearTimeout(silenceTimer);silenceTimer=null;}};
  const finish=()=>{
    if(finished)return;
    finished=true;clearTimer();
    try{recognition.stop();}catch{/* already stopped */}
    const text=finalText.replace(/\s+/g,' ').trim();
    if(text)onText(text.slice(0,2000));
    onEnd();
  };
  const resetSilence=()=>{clearTimer();silenceTimer=setTimeout(finish,silenceMs);};
  recognition.onresult=event=>{
    for(let i=event.resultIndex;i<event.results.length;i++){
      const r=event.results[i];
      if(r.isFinal&&r[0]?.transcript)finalText+=' '+r[0].transcript;
    }
    resetSilence();
  };
  recognition.onerror=event=>{
    if(event.error==='no-speech'){resetSilence();return;}           // keep listening through silence
    if(event.error==='aborted')return;                              // aborted; onend handles it
    if(event.error==='not-allowed')onError('Microphone permission was denied. You can type your message.');
    else onError('Voice input stopped. You can type your message.');
    finish();
  };
  recognition.onend=()=>{if(!finished){try{recognition.start();}catch{finish();}}};
  try{recognition.start();}catch{onError('Voice input is unavailable in this browser. Type your message instead.');finished=true;return {stop:()=>{},abort:()=>{}};}
  resetSilence();
  return {stop:()=>finish(),abort:()=>{finished=true;clearTimer();recognition.onresult=null;recognition.onerror=null;recognition.onend=null;try{recognition.abort();}catch{/* ok */}}};
}
