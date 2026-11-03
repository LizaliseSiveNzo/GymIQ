export function registerOfflineApp(){
 if(!import.meta.env.PROD||!('serviceWorker' in navigator))return;
 const register=()=>{
  const start=()=>{void navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(()=>navigator.serviceWorker.ready).then(()=>console.info('[GymIQ] Offline screens ready')).catch(()=>{/* Normal online use still works if storage is unavailable. */});};
  if('requestIdleCallback' in window)window.requestIdleCallback(start,{timeout:2500});else setTimeout(start,1200);
 };
 if(document.readyState==='complete')register();else window.addEventListener('load',register,{once:true});
}
