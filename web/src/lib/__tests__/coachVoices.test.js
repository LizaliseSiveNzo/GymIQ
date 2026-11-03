import {describe,it,expect} from 'vitest';
import {coachVoices,chooseCoachVoice} from '../coachVoice.js';
const voice=(name,lang,extra={})=>({name,lang,voiceURI:name,...extra});
describe('Microsoft browser voice trial',()=>{
 it('prefers Microsoft natural speech to a plain system voice',()=>{
  const rows=[voice('System English','en-ZA',{default:true}),voice('Microsoft Zira','en-US'),voice('Microsoft Sonia Online (Natural)','en-GB')];
  expect(chooseCoachVoice(rows).name).toContain('Sonia');
 });
 it('prefers a South African Microsoft natural voice when available',()=>{
  const rows=[voice('Microsoft Sonia Online (Natural)','en-GB'),voice('Microsoft Leah Online (Natural)','en-ZA')];
  expect(chooseCoachVoice(rows).name).toContain('Leah');
 });
 it('honours the user choice and gracefully falls back when a voice disappears',()=>{
  const rows=[voice('Microsoft Leah Online (Natural)','en-ZA'),voice('System English','en-US')];
  expect(chooseCoachVoice(rows,'System English').name).toBe('System English');
  expect(chooseCoachVoice(rows,'removed').name).toContain('Leah');
  expect(chooseCoachVoice([])).toBeNull();
 });
 it('uses only available English voices and tolerates missing or blocked voice services',()=>{
  const rows=[voice('French','fr-FR'),voice('System English','en-US'),voice('Microsoft Leah Online (Natural)','en-ZA')];
  expect(coachVoices({getVoices:()=>rows}).map(v=>v.lang)).toEqual(['en-ZA','en-US']);
  expect(coachVoices({})).toEqual([]);expect(coachVoices({getVoices(){throw Error('Unavailable');}})).toEqual([]);
 });
});
