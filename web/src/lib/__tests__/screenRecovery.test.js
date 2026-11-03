import {describe,it,expect,vi} from 'vitest';
import {isScreenDownloadError,claimScreenRecovery,refreshScreen} from '../screenRecovery.js';
describe('Screen recovery without losing workout logs',()=>{
 it('separates module downloads from runtime and database errors',()=>{
  for(const message of ['Failed to fetch dynamically imported module: /assets/old.js','Importing a module script failed.','Loading chunk 4 failed.','Unable to preload CSS for /assets/old.css'])expect(isScreenDownloadError(Error(message))).toBe(true);
  for(const message of ['Cannot read properties of undefined','permission denied','Failed to fetch'])expect(isScreenDownloadError(Error(message))).toBe(false);
 });
 it('bounds automatic retries and leaves unrelated device records intact',()=>{
  const rows=new Map([['queued workout','keep']]);const storage={getItem:k=>rows.get(k),setItem:(k,v)=>rows.set(k,v)};
  expect(claimScreenRecovery(storage,'/workout/history/one',1000)).toBe(true);
  expect(claimScreenRecovery(storage,'/workout/history/one',2000)).toBe(false);
  expect(claimScreenRecovery(storage,'/workout/history/one',302000)).toBe(true);
  expect(rows.get('queued workout')).toBe('keep');
  expect(claimScreenRecovery({getItem(){throw Error('blocked');}},'/one')).toBe(false);
 });
 it('activates the waiting public-code update before reloading',async()=>{
  const calls=[],events=new Map();
  const waiting={postMessage:vi.fn(message=>{calls.push(message.type);events.get('controllerchange')();})};
  const registration={update:async()=>calls.push('update'),waiting};
  const serviceWorker={getRegistration:async()=>registration,addEventListener:(n,cb)=>events.set(n,cb),removeEventListener:vi.fn()};
  await refreshScreen({serviceWorker,reload:()=>calls.push('reload')});
  expect(calls).toEqual(['update','GYMIQ_RECOVER_SCREEN','reload']);
 });
 it('releases recovery when update checking stalls and does not activate it later',async()=>{
  let release;const waiting={postMessage:vi.fn()};const reload=vi.fn();
  const serviceWorker={getRegistration:()=>new Promise(resolve=>{release=resolve;})};
  await refreshScreen({serviceWorker,reload,timeoutMs:5});
  release({update:async()=>{},waiting});await new Promise(resolve=>setTimeout(resolve,0));
  expect(reload).toHaveBeenCalledOnce();expect(waiting.postMessage).not.toHaveBeenCalled();
 });
 it('reloads even if service worker access fails',async()=>{
  const reload=vi.fn();await refreshScreen({serviceWorker:{getRegistration:async()=>{throw Error('blocked');}},reload});expect(reload).toHaveBeenCalledOnce();
 });
});
