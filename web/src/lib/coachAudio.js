// Cached speech stays in memory only. Prefetch warms the cache so "Read aloud"
// plays instantly; read() falls back to fetching on demand.
export function createCoachAudio({load,AudioClass=globalThis.Audio,now=Date.now}){
 let revision=0,controller,player;const cache=new Map();
 function stop(){revision++;controller?.abort();controller=null;if(player){player.onended=null;player.onerror=null;player.pause();player.removeAttribute?.('src');player.load?.();player=null;}}
 function blobFromAudio(audio,mimeType){
  const binary=atob(audio),bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return new Blob([bytes],{type:mimeType||'audio/wav'});
 }
 async function prefetch(id){
  const version=revision;
  try{
   if(cache.has(id)&&cache.get(id).expires>now())return;
   const result=await load(id,new AbortController().signal);
   if(version!==revision)return;
   if(!result?.audio)return;
   cache.set(id,{audio:result.audio,mimeType:result.mimeType,expires:now()+900000});
   if(cache.size>20)cache.delete(cache.keys().next().value);
  }catch{/* background prefetch failures are silent */}
 }
 async function read(id,onEnd){
  stop();const version=revision,activeController=new AbortController();controller=activeController;let timer;
  try{
   let saved=cache.get(id);
   if(!saved||saved.expires<=now()){
    const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{activeController.abort();reject(Error('Speech took too long. Try again.'));},130000);});
    const result=await Promise.race([load(id,activeController.signal),deadline]);
    if(version!==revision)return false;
    if(!result?.audio)throw Error('Invalid speech response');
    saved={audio:result.audio,mimeType:result.mimeType,expires:now()+900000};cache.set(id,saved);
    if(cache.size>20)cache.delete(cache.keys().next().value);
   }
   if(version!==revision)return false;
   const url=URL.createObjectURL(blobFromAudio(saved.audio,saved.mimeType));
   player=new AudioClass(url);const active=player;
   player.onended=()=>{URL.revokeObjectURL(url);if(version===revision)onEnd();};
   player.onerror=()=>{cache.delete(id);URL.revokeObjectURL(url);if(version===revision)onEnd(Error('Could not play audio. Please retry.'));};
   await active.play();return version===revision;
  }catch(error){if(version!==revision)return false;throw error;}
  finally{clearTimeout(timer);if(version===revision)controller=null;}
 }
 return {read,stop,prefetch};
}
