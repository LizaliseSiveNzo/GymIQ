import {beforeEach,describe,expect,it,vi} from 'vitest';
import {rememberWorkout,forgetWorkout,savedWorkoutRecovery,recoveryPath,recoveryFromLog,resumableLog,loadResumedWorkout} from '../workoutRecovery.js';
import {clockSnapshot,restoreClock} from '../sessionClock.js';
const user='user-one',id='11111111-1111-4111-8111-111111111111',day='22222222-2222-4222-8222-222222222222';
const log={id,client_id:user,day_id:day,created_at:'2026-11-02T19:00:00Z',completed_at:null,cancelled_at:null};
const storage=()=>{const values={};return {getItem:k=>values[k]??null,setItem:(k,v)=>{values[k]=v;},removeItem:k=>{delete values[k];}};};
beforeEach(()=>{vi.stubGlobal('localStorage',storage());vi.stubGlobal('sessionStorage',storage());});
describe('Workout recovery after app dismissal',()=>{
 it('remembers the exact unfinished session and day across a fresh read',()=>{rememberWorkout(user,log,'Full body A');expect(savedWorkoutRecovery(user)).toEqual({logId:id,dayId:day,label:'Full body A',startedAt:log.created_at});expect(recoveryPath(savedWorkoutRecovery(user))).toBe(`/workout/session/${day}?resume=${id}`);});
 it('recovers freestyle sessions by log ID rather than starting a new session',()=>{const pointer=rememberWorkout(user,{...log,day_id:null});expect(recoveryPath(pointer)).toBe(`/workout/session/free?resume=${id}`);});
 it('retains the same session across midnight and different weeks',()=>{expect(resumableLog(user,{...log,created_at:'2026-10-25T19:00:00Z'},day)).toBe(true);});
 it('never recovers a completed, cancelled, mismatched or foreign session',()=>{
  for(const change of [{completed_at:'done'},{cancelled_at:'cancelled'},{client_id:'other'},{id:'invalid'},{day_id:'bad'}])expect(recoveryFromLog(user,{...log,...change})).toBeNull();
  expect(resumableLog(user,log,null)).toBe(false);expect(resumableLog(user,null,day)).toBe(false);expect(savedWorkoutRecovery('other')).toBeNull();
 });
 it('clears matching recovery on finish/cancel without erasing another active workout',()=>{rememberWorkout(user,log);forgetWorkout(user,'33333333-3333-4333-8333-333333333333');expect(savedWorkoutRecovery(user)).not.toBeNull();forgetWorkout(user,id);expect(savedWorkoutRecovery(user)).toBeNull();});
 it('builds only internal, validated resume links',()=>{for(const pointer of [{logId:'https://evil.test'},{logId:id,dayId:'../../login'},{logId:null}])expect(()=>recoveryPath(pointer)).toThrow();});
 it('restores active time, rest and typed exercise drafts while paused without counting time away',()=>{
  const drafts={rows_example:{0:{kg:'45',reps:'10',source:'manual'}}};
  const snapshot=clockSnapshot({elapsedMs:96000,restMs:42000},{drafts,activeIdx:2,extraRows:{example:1}});
  const restored=restoreClock(snapshot,80,999999);
  expect(restored).toMatchObject({elapsedMs:96000,restMs:42000,paused:true});expect(snapshot.recovery.drafts).toEqual(drafts);expect(snapshot.recovery.activeIdx).toBe(2);
 });
 it('reads the exact original session without calling open_workout',async()=>{
  const query={select:vi.fn(()=>query),eq:vi.fn(()=>query),maybeSingle:vi.fn(async()=>({data:log,error:null}))};
  const client={from:vi.fn(()=>query),rpc:vi.fn()};
  expect(await loadResumedWorkout(client,{userId:user,dayId:day,resumeId:id})).toBe(log);
  expect(query.eq).toHaveBeenCalledWith('client_id',user);expect(query.eq).toHaveBeenCalledWith('id',id);expect(client.rpc).not.toHaveBeenCalled();
 });
 it('refuses closed or unavailable recovery links rather than silently opening a new log',async()=>{
  const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:{...log,completed_at:'finished'}})};
  await expect(loadResumedWorkout({from:()=>query},{userId:user,dayId:day,resumeId:id})).rejects.toThrow(/has ended/);
  await expect(loadResumedWorkout({from:vi.fn()},{userId:user,dayId:day,resumeId:'bad'})).rejects.toThrow(/invalid/);
 });
 it('does not perform a recovery lookup when starting a normal session',async()=>{
  const from=vi.fn();expect(await loadResumedWorkout({from},{userId:user,dayId:day,resumeId:null})).toBeNull();expect(from).not.toHaveBeenCalled();
 });
});
