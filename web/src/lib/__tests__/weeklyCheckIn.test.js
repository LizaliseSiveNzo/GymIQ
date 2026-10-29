import {describe,it,expect} from 'vitest';
import {buildWeeklyCheckIn,reviewWeek,weeklyTargetSuggestions} from '../weeklyCheckIn.js';
import {buildExerciseProgress} from '../exerciseProgress.js';
const row=(id,extra={})=>({id,log_id:id,exercise_id:'bench',exercise_name:'Bench',completed_at:'2026-10-22T12:00:00Z',completed:true,set_type:'normal',weight:50,reps:10,set_number:1,...extra});
const build=extra=>buildWeeklyCheckIn({week:'2026-10-19',...extra});
describe('weekly check-in evidence',()=>{
 it('defaults to the previous complete Monday–Sunday week and rejects future or malformed dates',()=>{for(const bad of [null,'banana','2026-10-26','2026-10-20','2026-99-99'])expect(reviewWeek(bad,'2026-10-29')).toBe('2026-10-19');expect(reviewWeek('2026-10-12','2026-10-29')).toBe('2026-10-12');});
 it('does not interpret missing or partial food logs as calorie deficits',()=>{const n=build({food:[{day:'2026-10-19',kcal:800,entries:1,complete:false,target:2000}]}).nutrition;expect(n.complete).toBe(0);expect(n.average).toBeNull();expect(n.difference).toBeNull();expect(n.days).toHaveLength(7);});
 it('uses only complete days with their own dated targets for comparison',()=>{const n=build({food:[{day:'2026-10-19',kcal:2100,complete:true,target:2000},{day:'2026-10-20',kcal:1800,complete:true,target:1900},{day:'2026-10-21',kcal:1500,complete:true},{day:'2026-10-22',kcal:400,complete:false,target:2000}]}).nutrition;expect(n.complete).toBe(3);expect(n.comparable).toBe(2);expect(n.average).toBe(1800);expect(n.difference).toBe(0);});
 it('requires at least two weights in each week to describe change',()=>{expect(build({weights:[{metric_date:'2026-10-21',weight_kg:80},{metric_date:'2026-10-14',weight_kg:81}]}).weight.change).toBeNull();const w=build({weights:[{metric_date:'2026-10-20',weight_kg:80},{metric_date:'2026-10-22',weight_kg:80.2},{metric_date:'2026-10-13',weight_kg:81},{metric_date:'2026-10-15',weight_kg:81.2}]}).weight;expect(w.average).toBe(80.1);expect(w.change).toBe(-1);});
 it('compares like exercises between weeks without counting warmups, duplicates or cancelled records',()=>{const a=row('a'),r=build({rows:[a,a,row('old',{completed_at:'2026-10-14T12:00:00Z',weight:47.5,reps:12}),row('warm',{set_type:'warmup'}),row('cancel',{cancelled_at:'2026-10-22'}),row('excluded',{excluded:true})]});expect(r.sets).toBe(1);expect(r.previousSets).toBe(1);expect(r.strength[0]).toMatchObject({change:2.5,latest:{weight:50,reps:10},before:{weight:47.5,reps:12}});});
 it('counts only matching programme days, while freestyle contributes to total sessions',()=>{const r=build({rows:[row('a'),row('b')],sessions:[{day:'2026-10-22',day_id:'a'},{day:'2026-10-23',day_id:'a'},{day:'2026-10-24',day_id:null}],programme:{created_at:'2026-10-01',name:'Plan'},days:[{id:'a'},{id:'b'}]});expect(r.completeDays).toBe(1);expect(r.plannedDays).toBe(2);expect(r.sessions).toBe(2);});
 it('does not invent missed workouts for a programme that started later',()=>{expect(build({programme:{created_at:'2026-10-22'},days:[{id:'a'}]}).plannedDays).toBeNull();});
 it('uses weaker side load and reps for paired comparisons',()=>{const r=build({rows:[row('paired',{weight:20,reps:12,weight_left:17.5,reps_left:10})]});expect(r.strength[0].latest).toEqual({weight:17.5,reps:10});});
 it('does not use the preceding month’s food data in the selected week',()=>{expect(build({food:[{day:'2026-10-01',kcal:2000,complete:true,target:2000}]}).nutrition.complete).toBe(0);});
});
describe('weekly approval proposals',()=>{
 const exercises=[{exercise_id:'bench',name:'Bench',target_sets:2,target_reps:'8-12'}];
 const progress=buildExerciseProgress([row('a',{log_id:'last',set_number:1}),row('b',{log_id:'last',set_number:2})]);
 const options={exercises,progress,feedback:[{log_id:'last',exercise_key:'bench',effort:'right'}],now:Date.parse('2026-10-23')};
 it('reuses coach checks and deduplicates repeated programme exercises',()=>{const result=weeklyTargetSuggestions({...options,exercises:[...exercises,...exercises]});expect(result).toHaveLength(1);expect(result[0].suggestion).toMatchObject({kind:'reps',weight:50,reps:11});});
 it('does not propose increases without effort feedback or from stale records',()=>{expect(weeklyTargetSuggestions({...options,feedback:[]})).toEqual([]);expect(weeklyTargetSuggestions({...options,now:Date.parse('2026-12-01')})).toEqual([]);});
 it('does not flatten different per-set rep advice into a persistent target',()=>{const different=buildExerciseProgress([row('a',{log_id:'last',set_number:1,reps:9}),row('b',{log_id:'last',set_number:2,reps:11})]);expect(weeklyTargetSuggestions({...options,progress:different})).toEqual([]);});
});
