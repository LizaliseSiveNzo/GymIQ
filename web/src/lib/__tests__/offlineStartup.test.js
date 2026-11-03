import {beforeEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {readView,saveView,clearViews,profileSnapshot,offlineWeek,DEVICE_PREFIX} from '../deviceCache.js';
const storage=()=>{const entries={};return Object.assign(entries,{getItem:vi.fn(key=>entries[key]??null),setItem:vi.fn((key,value)=>{entries[key]=value;}),removeItem:vi.fn(key=>{delete entries[key];})});};
beforeEach(()=>{vi.stubGlobal('localStorage',storage());vi.stubGlobal('sessionStorage',storage());});
describe('Fast, account-scoped saved screens',()=>{
 it('returns saved records without a server request and never reads another account',()=>{saveView('one','week',{days:[1]},1000);expect(readView('one','week',500,1100).data.days).toEqual([1]);expect(readView('two','week',500,1100)).toBeNull();});
 it('rejects expired, future-dated, corrupt and incorrectly owned snapshots',()=>{
  saveView('one','week',{},1000);expect(readView('one','week',100,1101)).toBeNull();expect(readView('one','week',100,999)).toBeNull();
  localStorage.setItem(DEVICE_PREFIX+'one:week','corrupt');expect(readView('one','week')).toBeNull();
  localStorage.setItem(DEVICE_PREFIX+'one:week',JSON.stringify({userId:'two',savedAt:Date.now(),data:{}}));expect(readView('one','week')).toBeNull();
 });
 it('uses session-only snapshots when Keep me signed in is off',()=>{localStorage.setItem('gymiq_remember','false');saveView('one','profile',{id:'one'});expect(localStorage.getItem(DEVICE_PREFIX+'one:profile')).toBeNull();expect(sessionStorage.getItem(DEVICE_PREFIX+'one:profile')).not.toBeNull();});
 it('clears only the signed-out account, preserving pending log storage and other users',()=>{saveView('one','profile',{});saveView('two','profile',{});localStorage.setItem('gymiq_session_one_test','pending');clearViews('one');expect(readView('one','profile')).toBeNull();expect(readView('two','profile')).not.toBeNull();expect(localStorage.getItem('gymiq_session_one_test')).toBe('pending');});
 it('omits credentials and health measurements from the startup profile',()=>{expect(profileSnapshot({id:'one',name:'Owner',role:'customer',onboarded_at:'today',weight:80,date_of_birth:'private',access_token:'secret'})).toEqual({id:'one',name:'Owner',role:'customer',onboarded_at:'today'});});
 it('does not grant write permission from cached training data',()=>{const snapshot={can_write:true,days:[1]};expect(offlineWeek(snapshot).can_write).toBe(false);expect(snapshot.can_write).toBe(true);});
 it('survives unavailable device storage',()=>{localStorage.getItem.mockImplementation(()=>{throw Error('blocked');});sessionStorage.getItem.mockImplementation(()=>{throw Error('blocked');});expect(()=>saveView('one','test',{})).not.toThrow();expect(readView('one','test')).toBeNull();});
});

function worker({cacheUnavailable=false,cacheFull=false}={}){
 const handlers={},stores=new Map();
 const cache=name=>{if(cacheUnavailable)throw Error('Cache blocked');if(!stores.has(name))stores.set(name,new Map());const rows=stores.get(name);return{addAll:async urls=>{for(const url of urls)rows.set(url,{url,ok:true,clone(){return this;}});},match:async req=>rows.get(typeof req==='string'?req:new URL(req.url).pathname),put:async(req,res)=>{if(cacheFull)throw Error('Quota exceeded');rows.set(req.url,res);},keys:async()=>[...rows.keys()],delete:async key=>rows.delete(key)};};
 const fetch=vi.fn(async()=>{throw Error('Offline');});
 const self={location:{origin:'https://gym.test'},addEventListener:(name,fn)=>{handlers[name]=fn;},clients:{claim:vi.fn()},skipWaiting:vi.fn()};
 vm.runInNewContext(readFileSync(new URL('../../../build/service-worker.js',import.meta.url),'utf8').replace('__BUILD_ID__','test').replace('__PRECACHE__',JSON.stringify(['/index.html','/assets/main-abc.js'])),{self,caches:{open:async name=>cache(name),keys:async()=>[...stores.keys()],delete:async name=>stores.delete(name)},URL,fetch});
 return {handlers,fetch,cache,self,request:async(url,mode='cors',method='GET')=>{let response;handlers.fetch({request:{url,mode,method},respondWith:p=>{response=p;}});return response;}};
}
describe('Installed app offline cache',()=>{
 it('still opens downloaded screens when cache storage is blocked or full',async()=>{
  for(const options of [{cacheUnavailable:true},{cacheFull:true}]){
   const w=worker(options),response={ok:true,type:'basic',clone(){return this;}};w.fetch.mockResolvedValue(response);
   expect(await w.request('https://gym.test/assets/history-new.js')).toBe(response);
   expect(await w.request('https://gym.test/workout/history/one','navigate')).toBe(response);
  }
 });
 it('activates a waiting update only when recovery requests it',()=>{
  const w=worker();expect(w.self.skipWaiting).not.toHaveBeenCalled();w.handlers.message({data:{type:'unrelated'}});expect(w.self.skipWaiting).not.toHaveBeenCalled();w.handlers.message({data:{type:'GYMIQ_RECOVER_SCREEN'}});expect(w.self.skipWaiting).toHaveBeenCalledOnce();
 });
 it('opens deep links with query strings from the shell while the network is unavailable',async()=>{const w=worker();let install;w.handlers.install({waitUntil:p=>{install=p;}});await install;const response=await w.request('https://gym.test/bank?section=builder','navigate');expect(response.url).toBe('/index.html');expect(w.fetch).not.toHaveBeenCalled();});
 it('serves precached code without waiting for network retries',async()=>{const w=worker();let install;w.handlers.install({waitUntil:p=>{install=p;}});await install;expect((await w.request('https://gym.test/assets/main-abc.js')).url).toBe('/assets/main-abc.js');expect(w.fetch).not.toHaveBeenCalled();});
 it('never intercepts authentication, private APIs, AI, checkout or writes',async()=>{const w=worker();for(const path of ['https://project.supabase.co/rest/v1/users','https://gym.test/api/private','https://gym.test/assets/a.js?token=private'])expect(await w.request(path)).toBeUndefined();expect(await w.request('https://gym.test/workout','navigate','POST')).toBeUndefined();expect(w.fetch).not.toHaveBeenCalled();});
});
