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
export function startCoachDictation({scope=globalThis,onText,onError,onEnd,silenceMs=2500}) {
  const Recognition=speechRecognitionClass(scope);
  if(!Recognition)throw Error('Voice input is unavailable in this browser. Type your message instead.');
  const recognition=new Recognition();
  recognition.lang='en-ZA';recognition.continuous=true;recognition.interimResults=true;
  try{recognition.maxAlternatives=1;}catch{/* optional — reduces noise on supporting browsers */}
  let finalText='',interim='',silenceTimer=null,finished=false;
  const clearTimer=()=>{if(silenceTimer){clearTimeout(silenceTimer);silenceTimer=null;}};
  const fullText=()=>((finalText+' '+interim).replace(/\s+/g,' ').trim());
  const emit=()=>{onText?.(fullText().slice(0,2000));};
  const finish=()=>{
    if(finished)return;
    finished=true;clearTimer();
    try{recognition.stop();}catch{/* already stopped */}
    const text=finalText.replace(/\s+/g,' ').trim();
    if(text)onText?.(text.slice(0,2000));
    onEnd?.();
  };
  const resetSilence=()=>{clearTimer();silenceTimer=setTimeout(finish,silenceMs);};
  recognition.onresult=event=>{
    interim='';
    for(let i=event.resultIndex;i<event.results.length;i++){
      const r=event.results[i];
      if(r.isFinal)finalText+=' '+(r[0]?.transcript||'');
      else interim+=' '+(r[0]?.transcript||'');
    }
    emit();          // live transcription, like ChatGPT/Claude
    resetSilence();
  };
  recognition.onerror=event=>{
    const e=event.error;
    if(e==='no-speech'){resetSilence();return;}                     // keep listening through silence
    if(e==='aborted')return;                                        // aborted; onend handles it
    if(e==='not-allowed'||e==='service-not-allowed')onError?.('Microphone permission was denied. You can type your message.');
    else if(e==='network')onError?.('Voice input lost its connection. You can type your message.');
    else if(e==='audio-capture')onError?.('No microphone was found. You can type your message.');
    else onError?.('Voice input stopped. You can type your message.');
    finish();
  };
  recognition.onend=()=>{if(!finished){try{recognition.start();}catch{finish();}}};
  try{recognition.start();}catch{onError?.('Voice input is unavailable in this browser. Type your message instead.');finished=true;return {stop:()=>{},abort:()=>{}};}
  resetSilence();
  return {stop:()=>finish(),abort:()=>{finished=true;clearTimer();recognition.onresult=null;recognition.onerror=null;recognition.onend=null;try{recognition.abort();}catch{/* ok */}}};
}
