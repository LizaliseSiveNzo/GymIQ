// Cached signed URLs stay in memory only. Prefetch warms the cache so
// "Read aloud" plays instantly; read() falls back to fetching on demand.
export function createCoachAudio({load,AudioClass=globalThis.Audio,now=Date.now}){
 let revision=0,controller,player;const cache=new Map();
 function stop(){revision++;controller?.abort();controller=null;if(player){player.onended=null;player.onerror=null;player.pause();player.removeAttribute?.('src');player.load?.();player=null;}}
 function ttl(result){return now()+Math.max(0,Math.min(Number(result?.expires_in)||0,900)-30)*1000;}
 async function prefetch(id,onReady){
  const version=revision;
  try{
   if(cache.has(id)&&cache.get(id).expires>now())return;
   const result=await load(id,new AbortController().signal);
   if(version!==revision)return;
   if(!result?.url||!/^https:\/\//.test(result.url))return;
   cache.set(id,{url:result.url,expires:ttl(result)});
   if(cache.size>20)cache.delete(cache.keys().next().value);
  }catch{/* background prefetch failures are silent */}
  finally{onReady?.();}
 }
 async function read(id,onEnd){
  stop();const version=revision,activeController=new AbortController();controller=activeController;let timer;
  try{
   let saved=cache.get(id);
   if(!saved||saved.expires<=now()){
    const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{activeController.abort();reject(Error('Speech took too long. Try again.'));},130000);});
    const result=await Promise.race([load(id,activeController.signal),deadline]);
    if(version!==revision)return false;
    if(!result?.url||!/^https:\/\//.test(result.url))throw Error('Invalid speech response');
    saved={url:result.url,expires:ttl(result)};cache.set(id,saved);
    if(cache.size>20)cache.delete(cache.keys().next().value);
   }
   if(version!==revision)return false;
   player=new AudioClass(saved.url);const active=player;
   player.onended=()=>{if(version===revision)onEnd();};
   player.onerror=()=>{cache.delete(id);if(version===revision){const labels={1:'aborted',2:'network',3:'decode',4:'unsupported'};const c=player?.error?.code;onEnd(Error(`Could not play audio — ${labels[c]||'error '+(c??'?')}. Please retry.`));}};
   await active.play();return version===revision;
  }catch(error){if(version!==revision)return false;throw error;}
  finally{clearTimeout(timer);if(version===revision)controller=null;}
 }
 return {read,stop,prefetch};
}
