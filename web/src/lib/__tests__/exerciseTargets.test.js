import { describe, expect, it, vi } from 'vitest';
vi.mock('../supabaseClient.js',()=>({supabase:{}}));
import { exerciseDefault, targetKey } from '../exerciseTargets.js';
import { buildExerciseProgress } from '../exerciseProgress.js';
import { validSetNumbers } from '../setNumbers.js';
const item={exerciseId:'bench',name:'Bench press'};
const progress=buildExerciseProgress([{id:'s1',exercise_id:'bench',exercise_name:'Bench press',log_id:'log',completed_at:'2026-10-01',created_at:'2026-10-01',completed:true,set_type:'normal',set_number:1,weight:30,reps:8}]);
describe('planned targets and recorded performance',()=>{
  it('prefills a saved target before any performed exercise exists',()=>{
    expect(exerciseDefault([],[{exercise_key:'bench',weight:20,reps:10}],item)).toMatchObject({weight:20,reps:10,source:'target'});
    expect(buildExerciseProgress([])).toEqual([]);
  });
  it('overrides defaults without changing the recorded PR',()=>{
    expect(exerciseDefault(progress,[{exercise_key:'bench',weight:999,reps:2}],item)).toMatchObject({weight:999,reps:2,source:'target'});
    expect(progress[0].bestWeight.weight).toBe(30);
  });
  it('returns to last performed values when the target is cleared',()=>{
    expect(exerciseDefault(progress,[],item)).toMatchObject({weight:30,reps:8,source:'previous'});
    expect(exerciseDefault([],[],item)).toMatchObject({weight:'',reps:'',source:'empty'});
  });
  it('keeps catalogue identities distinct and supports named legacy exercises',()=>{
    expect(exerciseDefault(progress,[{exercise_key:'other',weight:100,reps:3}],item).source).toBe('previous');
    expect(targetKey({name:'  Legacy Lift  '})).toBe('name:legacy lift');
  });
  it('rejects incomplete, negative, non-finite, fractional-rep and out-of-range corrections',()=>{
    for(const [kg,reps] of [['',10],[-1,10],[Infinity,10],[20,0],[20,2.5],[10000,3],[20,1001],[1.123,10]])expect(validSetNumbers(kg,reps)).toBe(false);
    expect(validSetNumbers(0,15)).toBe(true);
    expect(validSetNumbers('22.50','8')).toBe(true);
  });
});
