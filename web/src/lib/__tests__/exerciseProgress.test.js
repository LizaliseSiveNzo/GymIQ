import { describe, expect, it } from 'vitest';
import { buildExerciseProgress, previousFor, setDescription } from '../exerciseProgress.js';
const set = (patch={}) => ({id:'set1',exercise_id:'bench',exercise_name:'Bench press',log_id:'old',completed_at:'2026-10-01T10:00:00Z',created_at:'2026-10-01T09:00:00Z',weight:50,reps:10,completed:true,set_type:'normal',set_number:1,...patch});
describe('exercise records and repeat-session defaults',()=>{
  it('keeps load and rep records as real paired performances',()=>{
    const [p]=buildExerciseProgress([set({weight:100,reps:3}),set({id:'s2',weight:40,reps:20})]);
    expect(p.bestWeight).toMatchObject({weight:100,reps:3});
    expect(p.bestReps).toMatchObject({weight:40,reps:20});
  });
  it('defaults to each set in the most recent finished session, not all-time maxes',()=>{
    const progress=buildExerciseProgress([set({weight:100,reps:3}),set({id:'s2',log_id:'new',weight:60,reps:8,completed_at:'2026-10-20T10:00:00Z'}),set({id:'s3',log_id:'new',weight:55,reps:10,set_number:2,completed_at:'2026-10-20T10:00:00Z'})]);
    const exercise={exerciseId:'bench',name:'Renamed bench press'};
    expect(previousFor(progress,exercise,0)).toMatchObject({weight:60,reps:8});
    expect(previousFor(progress,exercise,1)).toMatchObject({weight:55,reps:10});
    expect(previousFor(progress,exercise,3)).toMatchObject({weight:60,reps:8});
    expect(progress[0].sessions).toHaveLength(2);
  });
  it('excludes unfinished, cancelled, removed and warm-up performances',()=>{
    const p=buildExerciseProgress([set(),set({id:'draft',completed_at:null,weight:900}),set({id:'cancel',cancelled_at:'2026-10-20',weight:800}),set({id:'skip',excluded:true,weight:700}),set({id:'warmup',set_type:'warmup',weight:600}),set({id:'unchecked',completed:false,weight:500})]);
    expect(p[0].sets).toHaveLength(1);
    expect(p[0].bestWeight.weight).toBe(50);
  });
  it('retains zero-load bodyweight reps and does not merge distinct catalogue IDs',()=>{
    const p=buildExerciseProgress([set({exercise_id:'pushup',weight:0,reps:15}),set({exercise_id:'other',weight:20,reps:8})]);
    expect(p).toHaveLength(2);
    expect(previousFor(p,{exerciseId:'pushup',name:'Bench press'})).toMatchObject({weight:0,reps:15});
    expect(previousFor(p,{exerciseId:'missing',name:'Bench press'})).toBeNull();
  });
  it('keeps independent right and left performances visible',()=>{
    const [p]=buildExerciseProgress([set({weight:20,reps:8,weight_left:15,reps_left:12})]);
    expect(p.bestWeight).toMatchObject({weight:20,reps:8,side:'R'});
    expect(p.bestReps).toMatchObject({weight:15,reps:12,side:'L'});
    expect(setDescription(p.lastBest)).toBe('R 20 kg × 8 · L 15 kg × 12');
  });
});
