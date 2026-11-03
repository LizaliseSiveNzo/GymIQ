const RETRY_KEY='gymiq_screen_recovery';
export function isScreenDownloadError(error){
 return /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError|Unable to preload CSS|error loading dynamically imported module/i.test(String(error?.message||error));
}
// One automatic refresh per location in five minutes, never a reload loop.
export function claimScreenRecovery(storage,path,now=Date.now()){
 try{
  const last=JSON.parse(storage.getItem(RETRY_KEY)||'null');
  if(last?.path===path&&now-last.at<300000)return false;
  storage.setItem(RETRY_KEY,JSON.stringify({path,at:now}));return true;
 }catch{return false;}
}
export async function refreshScreen({serviceWorker=navigator.serviceWorker,reload=()=>window.location.reload(),timeoutMs=8000}={}){
 // Update only public app code. Never clear localStorage, IndexedDB or queued logs.
 let timer,changed,expired=false,installing,installed;
 try{
  await Promise.race([(async()=>{
   const registration=await serviceWorker?.getRegistration();if(!registration)return;
   await registration.update();
   if(expired)return;
   if(registration.installing){
    installing=registration.installing;
    await new Promise(resolve=>{
     installed=()=>{if(['installed','redundant'].includes(installing.state))resolve();};
     installing.addEventListener('statechange',installed);installed();
    });
   }
   if(expired||!registration.waiting)return;
   await new Promise(resolve=>{
    changed=resolve;serviceWorker.addEventListener('controllerchange',changed,{once:true});
    registration.waiting.postMessage({type:'GYMIQ_RECOVER_SCREEN'});
   });
  })(),new Promise(resolve=>{timer=setTimeout(()=>{expired=true;resolve();},timeoutMs);})]);
 }catch{/* A refresh is still useful when service workers are unavailable. */}
 finally{expired=true;clearTimeout(timer);if(changed)serviceWorker?.removeEventListener('controllerchange',changed);if(installed)installing.removeEventListener('statechange',installed);reload();}
}
