import {describe,it,expect,vi} from 'vitest';
import {speechSSML,microsoftSpeech} from '../../../../supabase/functions/_shared/microsoftSpeech.js';
describe('Microsoft speech request',()=>{
 it('escapes reply text instead of treating it as voice instructions',()=>{const xml=speechSSML('Hi <voice name="evil"> & gym');expect(xml).toContain('&lt;voice name=&quot;evil&quot;&gt; &amp;');expect(xml).toContain('en-ZA-LeahNeural');});
 it('rejects empty or oversized replies and invalid region hosts',async()=>{expect(()=>speechSSML('')).toThrow();expect(()=>speechSSML('a'.repeat(8001))).toThrow();await expect(microsoftSpeech({text:'Hello',key:'test',region:'evil.com/path'})).rejects.toThrow();});
 it('keeps credentials in headers and requests compact MP3 audio',async()=>{
  const fetchImpl=vi.fn(async()=>new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'audio/mpeg'}}));
  expect((await microsoftSpeech({text:'Hello',key:'fixture-key',region:'southafricanorth',fetchImpl})).byteLength).toBe(3);
  const [url,options]=fetchImpl.mock.calls[0];expect(url).not.toContain('fixture-key');expect(options.headers['Ocp-Apim-Subscription-Key']).toBe('fixture-key');expect(options.headers['X-Microsoft-OutputFormat']).toContain('mp3');
 });
 it('does not return provider error bodies or accept non-audio responses',async()=>{
  await expect(microsoftSpeech({text:'Hello',key:'test',region:'eastus',fetchImpl:async()=>new Response('private provider detail',{status:429})})).rejects.toThrow('temporarily unavailable');
  await expect(microsoftSpeech({text:'Hello',key:'test',region:'eastus',fetchImpl:async()=>new Response('not audio')})).rejects.toThrow('Invalid speech response');
 });
});
