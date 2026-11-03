// Cached signed URLs stay in memory only. Cancelling cannot start late playback.
export function createCoachAudio({load,AudioClass=globalThis.Audio,now=Date.now}){
 let revision=0,controller,player;const cache=new Map();
 function stop(){revision++;controller?.abort();controller=null;if(player){player.onended=null;player.onerror=null;player.pause();player.removeAttribute?.('src');player.load?.();player=null;}}
 async function read(id,onEnd){
  stop();const version=revision,activeController=new AbortController();controller=activeController;let timer;
  try{
   let saved=cache.get(id);
   if(!saved||saved.expires<=now()){
    const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{activeController.abort();reject(Error('Speech took too long. Try again.'));},35000);});
    const result=await Promise.race([load(id,activeController.signal),deadline]);
    if(version!==revision)return false;
    if(!result?.url||!/^https:\/\//.test(result.url))throw Error('Invalid speech response');
    saved={url:result.url,expires:now()+Math.max(0,Math.min(Number(result.expires_in)||0,900)-30)*1000};cache.set(id,saved);
    if(cache.size>20)cache.delete(cache.keys().next().value);
   }
   if(version!==revision)return false;
   player=new AudioClass(saved.url);const active=player;
   player.onended=()=>{if(version===revision)onEnd();};
   player.onerror=()=>{cache.delete(id);if(version===revision)onEnd(Error('Could not play Microsoft audio. Please retry.'));};
   await active.play();return version===revision;
  }catch(error){if(version!==revision)return false;throw error;}
  finally{clearTimeout(timer);if(version===revision)controller=null;}
 }
 return {read,stop};
}
