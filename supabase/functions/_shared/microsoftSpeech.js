export const MICROSOFT_VOICE='en-ZA-LeahNeural';
export function speechSSML(text){
 if(typeof text!=='string'||!text.trim()||text.length>8000)throw Error('Reply unavailable for speech');
 const escaped=text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,' ').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
 return `<speak version="1.0" xml:lang="en-ZA"><voice name="${MICROSOFT_VOICE}">${escaped}</voice></speak>`;
}
export async function microsoftSpeech({text,key,region,fetchImpl=fetch,signal}){
 if(!key||!region||!/^[a-z0-9]{2,40}$/.test(region))throw Error('Microsoft speech is not configured');
 const response=await fetchImpl(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,{method:'POST',headers:{'Ocp-Apim-Subscription-Key':key,'Content-Type':'application/ssml+xml','X-Microsoft-OutputFormat':'audio-24khz-48kbitrate-mono-mp3','User-Agent':'GymIQ'},body:speechSSML(text),signal});
 if(!response.ok)throw Error('Microsoft speech is temporarily unavailable');
 if(!response.headers.get('content-type')?.includes('audio/'))throw Error('Invalid speech response');
 const bytes=await response.arrayBuffer();if(!bytes.byteLength||bytes.byteLength>5000000)throw Error('Invalid speech size');return bytes;
}
