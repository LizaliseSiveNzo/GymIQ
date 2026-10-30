export function speechRecognitionClass(scope=globalThis) {
  return scope.SpeechRecognition || scope.webkitSpeechRecognition || null;
}
export function startCoachDictation({scope=globalThis,onText,onError,onEnd}) {
  const Recognition=speechRecognitionClass(scope);
  if(!Recognition)throw Error('Voice input is unavailable in this browser. Type your message instead.');
  const recognition=new Recognition();
  recognition.lang='en-ZA';recognition.continuous=false;recognition.interimResults=false;
  recognition.onresult=event=>{
    const text=Array.from(event.results).map(r=>r[0]?.transcript||'').join(' ').trim();
    if(text)onText(text.slice(0,2000));
  };
  recognition.onerror=event=>onError(event.error==='not-allowed'?'Microphone permission was denied. You can type your message.':event.error==='no-speech'?'No speech detected. Try again or type your message.':'Voice input stopped. You can type your message.');
  recognition.onend=onEnd;recognition.start();
  return {stop:()=>recognition.stop(),abort:()=>{recognition.onresult=null;recognition.onerror=null;recognition.onend=null;recognition.abort();}};
}
