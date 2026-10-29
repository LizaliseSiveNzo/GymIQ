import {describe,it,expect} from 'vitest';
import {progressionSuggestion,swapMatches} from '../progressionCoach.js';
const now=Date.parse('2026-10-29T12:00:00Z');
const item={name:'Bench press',exerciseId:'bench',scheme:{sets:3,repMin:8,repMax:12},equipmentIds:['barbell']};
const sets=(reps=[12,12,12],weight=50)=>reps.map((r,i)=>({id:`set${i}`,weight,reps:r,completed:true,set_type:'normal'}));
const session=(id,rows,date='2026-10-27T12:00:00Z')=>({id,sets:rows,date});
function args({rows=sets(),prior=sets(),effort='right',previous='right',...rest}={}){
 const sessions=[session('latest',rows),session('prior',prior,'2026-10-24T12:00:00Z')];
 return {item,progress:[{key:'bench',sessions,last:sessions[0]}],feedback:[{log_id:'latest',exercise_key:'bench',effort},{log_id:'prior',exercise_key:'bench',effort:previous}],increment:2.5,now,...rest};
}
describe('reviewable progression coach',()=>{
 it('requires a baseline before prescribing',()=>{expect(progressionSuggestion({item,now}).canApply).toBe(false);});
 it('suggests a small available increase only after two complete rated top-range sessions',()=>{const r=progressionSuggestion(args());expect(r.kind).toBe('load');expect(r.weight).toBe(52.5);expect(r.reps).toBe(8);});
 it('will not progress based on an incomplete or unrated session',()=>{expect(progressionSuggestion(args({rows:sets([12,12])})).kind).toBe('hold');expect(progressionSuggestion(args({effort:null})).kind).toBe('hold');expect(progressionSuggestion(args({previous:null})).kind).toBe('hold');});
 it('adds reps individually without reducing stronger sets or exceeding the range',()=>{const r=progressionSuggestion(args({rows:sets([9,10,12])}));expect(r.kind).toBe('reps');expect(r.weight).toBe(50);expect(r.rowReps).toEqual([10,11,12]);});
 it('requires a repeated top-range session at the same load',()=>{expect(progressionSuggestion(args({prior:sets([11,12,12])})).kind).toBe('hold');expect(progressionSuggestion(args({prior:sets([12,12,12],45)})).kind).toBe('hold');});
 it('never suggests an increase on tired/sore days or optional make-up work',()=>{for(const readiness of ['tired','sore'])expect(progressionSuggestion(args({readiness})).kind).toBe('hold');expect(progressionSuggestion(args({item:{...item,optional:true}})).kind).toBe('hold');});
 it('offers one smaller step for a too-hard session, with bounded reductions',()=>{const r=progressionSuggestion(args({effort:'hard'}));expect(r.kind).toBe('reduce');expect(r.weight).toBe(47.5);expect(r.reps).toBe(8);expect(progressionSuggestion(args({effort:'hard',increment:20})).canApply).toBe(false);});
 it('rejects oversized or unknown load increments',()=>{expect(progressionSuggestion(args({increment:10})).kind).toBe('hold');expect(progressionSuggestion(args({increment:null})).canApply).toBe(false);});
 it('does not transfer a stronger side’s performance to a weaker side',()=>{const rows=sets().map(s=>({...s,weight_left:50,reps_left:9}));const r=progressionSuggestion(args({rows}));expect(r.kind).toBe('reps');expect(r.rowReps).toEqual([10,10,10]);});
 it('requires manual review for asymmetric loads and assistance machines',()=>{expect(progressionSuggestion(args({rows:sets().map(s=>({...s,weight_left:40,reps_left:12}))})).canApply).toBe(false);expect(progressionSuggestion(args({item:{...item,name:'Assisted chin-up'}})).canApply).toBe(false);});
 it('keeps bodyweight progression rep-based and stale records conservative',()=>{expect(progressionSuggestion(args({rows:sets([9,9,9],0),prior:sets([9,9,9],0)})).weight).toBe(0);const a=args();a.progress[0].sessions[0].date='2026-09-01T12:00:00Z';expect(progressionSuggestion(a).kind).toBe('hold');});
 it('ignores current unfinished-session feedback when reviewing completed history',()=>{const a=args();a.feedback.unshift({log_id:'current',exercise_key:'bench',effort:'hard'});expect(progressionSuggestion(a).kind).toBe('load');});
 it('restricts swap suggestions to matching muscle and movement, excluding duplicates',()=>{const source={id:'a',primary_muscle_id:'chest',movement_pattern:'horizontal_push'};const candidate={id:'b',primary_muscle_id:'chest',movement_pattern:'horizontal_push'};expect(swapMatches(source,candidate)).toBe(true);expect(swapMatches(source,{...candidate,primary_muscle_id:'quads'})).toBe(false);expect(swapMatches(source,{...candidate,movement_pattern:'vertical_push'})).toBe(false);expect(swapMatches(source,candidate,['b'])).toBe(false);expect(swapMatches(null,candidate)).toBe(false);});
});
