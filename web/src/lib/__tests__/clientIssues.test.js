import {afterEach,describe,expect,it,vi} from 'vitest';
const rpc=vi.hoisted(()=>vi.fn());
vi.mock('../supabaseClient.js',()=>({supabase:{rpc}}));
import {reportClientIssue} from '../clientIssues.js';
afterEach(()=>{vi.unstubAllGlobals();rpc.mockReset();});
describe('nonblocking reliability counters',()=>{
 it('never sends record contents and throttles repeated errors',()=>{
  vi.stubGlobal('navigator',{onLine:true});rpc.mockResolvedValue({data:null});
  reportClientIssue('one','sync_failed');reportClientIssue('one','sync_failed');
  expect(rpc).toHaveBeenCalledTimes(1);expect(rpc).toHaveBeenCalledWith('record_client_issue',{p_kind:'sync_failed'});
 });
 it('ignores offline, signed-out and unrecognised reports',()=>{
  vi.stubGlobal('navigator',{onLine:false});reportClientIssue('two','sync_failed');
  vi.stubGlobal('navigator',{onLine:true});reportClientIssue(null,'sync_failed');reportClientIssue('two','private-error-text');expect(rpc).not.toHaveBeenCalled();
 });
 it('cannot throw into the workout flow when telemetry fails',async()=>{
  vi.stubGlobal('navigator',{onLine:true});rpc.mockImplementation(()=>{throw Error('unavailable');});
  expect(()=>reportClientIssue('three','workout_save_failed')).not.toThrow();
  rpc.mockRejectedValue(Error('offline'));expect(()=>reportClientIssue('four','sync_failed')).not.toThrow();await Promise.resolve();
 });
});
