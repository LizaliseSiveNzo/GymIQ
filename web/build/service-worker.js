/* Public app files only. Never intercept Supabase, AI, auth, payments or POSTs. */
const BUILD='__BUILD_ID__';
const SHELL=`gymiq-shell-${BUILD}`,RUNTIME=`gymiq-public-${BUILD}`;
const PRECACHE=__PRECACHE__;
self.addEventListener('install',event=>{event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(PRECACHE)));});
// Only an explicit recovery from a failed screen may activate a waiting update.
self.addEventListener('message',event=>{if(event.data?.type==='GYMIQ_RECOVER_SCREEN')void self.skipWaiting();});
// Do not skipWaiting during normal use: an open workout retains its app version.
self.addEventListener('activate',event=>{event.waitUntil((async()=>{
 for(const name of await caches.keys())if((name.startsWith('gymiq-shell-')||name.startsWith('gymiq-public-'))&&name!==SHELL&&name!==RUNTIME)await caches.delete(name);
 await self.clients.claim();
})());});
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin)return;
 if(req.mode==='navigate'){
  event.respondWith((async()=>{try{const saved=await(await caches.open(SHELL)).match('/index.html');if(saved)return saved;}catch{/* Device cache failure must not block an online screen. */}return fetch(req);})());return;
 }
 if(url.search)return;
 const isAsset=/^\/assets\/[\w.-]+\.(js|css)$/.test(url.pathname)||/^\/exercises\/[\w-]+\.webp$/.test(url.pathname)||['/app-icon.svg','/manifest.webmanifest'].includes(url.pathname);
 if(!isAsset)return;
 event.respondWith((async()=>{
  let cache;
  try{
   const core=await(await caches.open(SHELL)).match(req);if(core)return core;
   cache=await caches.open(RUNTIME);const saved=await cache.match(req);if(saved)return saved;
  }catch{/* Network access still works when device storage is full or blocked. */}
  const response=await fetch(req);
  if(cache&&response.ok&&response.type!=='opaque'&&!response.headers?.get('content-type')?.includes('text/html')){
   try{
    await cache.put(req,response.clone());
    const keys=await cache.keys();for(const key of keys.slice(0,Math.max(0,keys.length-70)))await cache.delete(key);
   }catch{/* A successful download is usable even if saving its copy fails. */}
  }
  return response;
 })());
});
