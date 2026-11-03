import {describe,it,expect,vi} from 'vitest';
import {createCoachAudio} from '../coachAudio.js';
describe('Microsoft audio playback',()=>{
 const fixture=load=>{
  const instances=[];class Audio{constructor(url){this.url=url;instances.push(this);}play=vi.fn(async()=>{});pause=vi.fn();removeAttribute=vi.fn();load=vi.fn();}
  return {reader:createCoachAudio({load,AudioClass:Audio}),instances};
 };
 it('reuses unexpired audio without paying for another generation',async()=>{
  const load=vi.fn(async()=>({url:'https://audio.test/one',expires_in:900})),f=fixture(load);
  await f.reader.read('one',()=>{});f.reader.stop();await f.reader.read('one',()=>{});
  expect(load).toHaveBeenCalledOnce();expect(f.instances[0].pause).toHaveBeenCalled();
 });
 it('does not play a late response after Stop reading',async()=>{
  let resolve;const f=fixture(()=>new Promise(done=>{resolve=done;}));const pending=f.reader.read('one',()=>{});f.reader.stop();resolve({url:'https://audio.test/one',expires_in:900});
  expect(await pending).toBe(false);expect(f.instances).toHaveLength(0);
 });
 it('does not let an older reply interrupt a newer reply',async()=>{
  let resolve;const f=fixture(id=>id==='old'?new Promise(done=>{resolve=done;}):Promise.resolve({url:'https://audio.test/new',expires_in:900}));
  const old=f.reader.read('old',()=>{});await f.reader.read('new',()=>{});resolve({url:'https://audio.test/old',expires_in:900});await old;
  expect(f.instances.map(a=>a.url)).toEqual(['https://audio.test/new']);
 });
 it('reports play rejection and keeps the cached URL for a user-initiated retry',async()=>{
  const load=vi.fn(async()=>({url:'https://audio.test/one',expires_in:900}));class Blocked{play(){return Promise.reject(Object.assign(Error('Tap again'),{name:'NotAllowedError'}));}pause(){}}
  const reader=createCoachAudio({load,AudioClass:Blocked});await expect(reader.read('one',()=>{})).rejects.toMatchObject({name:'NotAllowedError'});await expect(reader.read('one',()=>{})).rejects.toThrow();expect(load).toHaveBeenCalledOnce();
 });
});
