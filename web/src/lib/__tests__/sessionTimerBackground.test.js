import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const harness=vi.hoisted(()=>({effects:[]}));
vi.mock('react',()=>({useRef:value=>({current:value}),useState:value=>[value,()=>{}],useCallback:fn=>fn,useEffect:fn=>harness.effects.push(fn)}));
import useSessionTimer from '../../hooks/useSessionTimer.js';

describe('workout background lifecycle',()=>{
 let cleanup,timer,restEnd,checkpoint,store;
 beforeEach(()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-03T10:00:00Z'));
  const document=new EventTarget();document.visibilityState='visible';
  vi.stubGlobal('document',document);vi.stubGlobal('window',new EventTarget());
  store=new Map();vi.stubGlobal('localStorage',{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)});
  harness.effects=[];restEnd=vi.fn();checkpoint=vi.fn();
  timer=useSessionTimer({onRestEnd:restEnd,onCheckpoint:checkpoint,getRecovery:()=>({activeIdx:2})});
  cleanup=harness.effects.map(fn=>fn());
  timer.initialize({key:'workout-test',serverSeconds:0,startFresh:true});
 });
 afterEach(()=>{cleanup.forEach(fn=>fn?.());vi.unstubAllGlobals();vi.useRealTimers();});
 const advanceSuspended=ms=>vi.setSystemTime(Date.now()+ms);
 it('keeps running on lock/app switch and catches up after suspended ticks',()=>{
  timer.changeRest(90);
  document.visibilityState='hidden';document.dispatchEvent(new Event('visibilitychange'));
  expect(timer.isPaused()).toBe(false);
  advanceSuspended(300000);
  document.visibilityState='visible';document.dispatchEvent(new Event('visibilitychange'));
  expect(timer.getSeconds()).toBe(300);expect(timer.isPaused()).toBe(false);
  expect(restEnd).toHaveBeenCalledTimes(1);
  const saved=JSON.parse(store.get('workout-test'));
  expect(saved).toMatchObject({version:2,paused:false,elapsedMs:300000,restMs:0,recovery:{activeIdx:2}});
  vi.advanceTimersByTime(1000);expect(timer.getSeconds()).toBe(301);expect(restEnd).toHaveBeenCalledTimes(1);
  expect(checkpoint).toHaveBeenLastCalledWith(300);
 });
 it('saves page suspension without pausing, but pauses when navigating out of the workout',()=>{
  advanceSuspended(40000);window.dispatchEvent(new Event('pagehide'));
  expect(timer.isPaused()).toBe(false);expect(timer.getSeconds()).toBe(40);
  advanceSuspended(80000);window.dispatchEvent(new Event('pageshow'));
  expect(timer.getSeconds()).toBe(120);
  cleanup.forEach(fn=>fn?.());cleanup=[];
  expect(JSON.parse(store.get('workout-test'))).toMatchObject({paused:true,elapsedMs:120000});
 });
 it('does not resume a manual pause when returning to the app',()=>{
  advanceSuspended(20000);timer.pause();
  document.visibilityState='hidden';document.dispatchEvent(new Event('visibilitychange'));
  advanceSuspended(600000);
  document.visibilityState='visible';document.dispatchEvent(new Event('visibilitychange'));
  expect(timer.getSeconds()).toBe(20);expect(timer.isPaused()).toBe(true);
  timer.resume();vi.advanceTimersByTime(2000);expect(timer.getSeconds()).toBe(22);
 });
});
