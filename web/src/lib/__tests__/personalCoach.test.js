import {describe,it,expect,vi} from 'vitest';
import foods from '../../../../supabase/functions/_shared/nutrition/foods.json';
import {validateMeal,validateMealPlan,validateWorkout,validateTool,validateKitchen,COACH_TOOLS} from '../../../../supabase/functions/_shared/coach.js';
import {deepseekPayload,callDeepSeek} from '../../../../supabase/functions/_shared/deepseek.js';
import {planMatchesDiet,shufflePlan} from '../../../../supabase/functions/_shared/nutrition/planner.js';
import {startCoachDictation,speechRecognitionClass} from '../coachVoice.js';

const context={foods,kitchen:{pantry:foods.map(f=>f.id),equipment:['dumbbells']},diet:'regular',excludes:[],target:2200,day:'2026-10-30',exercises:[{id:'one',name:'Dumbbell press',equipment_ids:['dumbbells'],movement_pattern:'horizontal_push'},{id:'two',name:'Bodyweight squat',equipment_ids:['bodyweight'],movement_pattern:'squat'},{id:'three',name:'Barbell squat',equipment_ids:['barbell'],movement_pattern:'squat'}]};
const meal=(slot='lunch')=>({slot,name:'Chicken & rice',preparation:'Use cooked ingredients; serve together.',items:[{food_id:'171477',grams:150},{food_id:'169704',grams:180},{food_id:'169967',grams:120}]});
const workout=()=>({name:'Home plan',goal:'hypertrophy',session_minutes:45,days:[{name:'Full body',exercises:['one','two'].map(exercise_id=>({exercise_id,sets:3,rep_min:8,rep_max:12,rest_seconds:90}))}]});
describe('Personal coach validated action boundary',()=>{
 it('calculates custom meal nutrition from catalogue portions, ignoring invented totals',()=>{const v=validateMeal({...meal(),kcal:1,protein:9000},context);expect(v.kcal).toBeGreaterThan(400);expect(v.protein).toBeLessThan(100);expect(v.recipe_id).toBe('coach-custom');});
 it('rejects unavailable, unknown, duplicate or nonnumeric ingredients',()=>{
  expect(()=>validateMeal(meal(),{...context,kitchen:{...context.kitchen,pantry:[]}})).toThrow(/available/);
  for(const items of [[{food_id:'fiction',grams:100}],[...meal().items,meal().items[0]],[{food_id:'171477',grams:'100'}],[{food_id:'171477',grams:Infinity}],[{food_id:'171477',grams:1001}]])expect(()=>validateMeal({...meal(),items},context)).toThrow();
 });
 it('respects allergens and vegetarian opt-in, with mixed mains as default',()=>{
  const plant={...meal(),items:[{food_id:'169704',grams:200},{food_id:'169967',grams:100}]};
  expect(()=>validateMeal(plant,context)).toThrow(/meat or fish/);
  expect(validateMeal(plant,{...context,diet:'vegetarian'}).kcal).toBeGreaterThan(50);
  expect(()=>validateMeal(meal(),{...context,diet:'vegetarian'})).toThrow(/diet/);
  expect(()=>validateMeal({...meal('snack'),items:[{food_id:'170886',grams:150}]},{...context,excludes:['milk']})).toThrow(/exclusions/);
 });
 it('balances four custom meals to the existing target, without creating an intake log',()=>{
  const plan=validateMealPlan({meals:['breakfast','lunch','snack','dinner'].map(s=>meal(s))},context);
  expect(plan.meals.reduce((n,m)=>n+m.kcal,0)).toBeCloseTo(2200,0);
  expect(plan.target).toBe(2200);expect(plan.day).toBe('2026-10-30');
  expect(planMatchesDiet(plan.meals,foods,'regular',[])).toBe(true);
  expect(planMatchesDiet(plan.meals,foods,'vegetarian',[])).toBe(false);
  const shuffled=shufflePlan(plan.meals,2200,foods,'regular',[],'snack',()=>0);
  expect(shuffled.find(m=>m.slot==='lunch')).toEqual(plan.meals.find(m=>m.slot==='lunch'));
 });
 it('rejects plans with missing/duplicate meal slots or an unsupported target',()=>{
  expect(()=>validateMealPlan({meals:[meal(),meal(),meal(),meal()]},context)).toThrow(/breakfast/);
  expect(()=>validateMealPlan({meals:['breakfast','lunch','snack','dinner'].map(s=>meal(s))},{...context,target:null})).toThrow(/Monthly goal/);
 });
 it('creates canonical workout names, conservative defaults and valid deload weeks',()=>{
  const result=validateWorkout(workout(),context);
  expect(result.generated.days[0].exercises[0].name).toBe('Dumbbell press');
  expect(result.generated.days[0].exercises[0].rir).toBe(2);
  expect(result.generated.weeks[3]).toEqual({weekNumber:4,kind:'deload',volumeMultiplier:.5});
  expect(result.generated.days[0].exercises[0].target_weight).toBeUndefined();
 });
 it('rejects unavailable equipment and invented or duplicated exercises',()=>{
  for(const id of ['three','missing','one']){const w=workout();w.days[0].exercises[1].exercise_id=id;expect(()=>validateWorkout(w,context)).toThrow(/available equipment/);}
 });
 it('bounds training volume, reps and rest',()=>{
  for(const [key,value] of [['sets',5],['rep_min',1],['rep_max',30],['rest_seconds',0]]){const w=workout();w.days[0].exercises[0][key]=value;expect(()=>validateWorkout(w,context)).toThrow();}
  const w=workout();w.days=Array.from({length:7},()=>w.days[0]);expect(()=>validateWorkout(w,context)).toThrow();
 });
 it('offers only draft tools, rejecting arbitrary mutations',()=>{
  expect(COACH_TOOLS.map(t=>t.function.name)).toEqual(['draft_meal','draft_meal_plan','draft_workout']);
  expect(()=>validateTool('execute_sql',{query:'delete everything'},context)).toThrow(/not supported/);
  expect(validateTool('draft_meal',meal(),context).kind).toBe('meal');
 });
 it('validates saved pantry/equipment and handles bodyweight-only selection',()=>{
  expect(validateKitchen({pantry:[],equipment:[]},foods,[])).toEqual({pantry:[],equipment:[]});
  expect(()=>validateKitchen({pantry:['unknown'],equipment:[]},foods,[])).toThrow();
 });
});
describe('DeepSeek provider contract',()=>{
 it('uses current DeepSeek models, JSON output or allowlisted tools and bounded non-thinking completions',()=>{
  const payload=deepseekPayload([{role:'user',content:'Return json'}]);expect(payload.model).toBe('deepseek-flash');expect(payload.thinking.type).toBe('disabled');expect(payload.max_tokens).toBe(768);expect(payload.response_format.type).toBe('json_object');
  const tools=deepseekPayload([],{tools:COACH_TOOLS,maxTokens:3500});expect(tools.response_format).toBeUndefined();expect(tools.tools).toEqual(COACH_TOOLS);
  expect(()=>deepseekPayload([],{model:'untrusted-model'})).toThrow();
 });
 it('calls only DeepSeek, does not return raw provider error bodies',async()=>{
  const fetcher=vi.fn().mockResolvedValue({ok:false,status:402,json:async()=>({secret:'never shown'})});
  await expect(callDeepSeek('test-key',deepseekPayload([]),fetcher)).rejects.toThrow(/balance/);
  expect(fetcher.mock.calls[0][0]).toBe('https://api.deepseek.com/chat/completions');
 });
 it('rejects truncated model output',async()=>{await expect(callDeepSeek('test',{},async()=>({ok:true,json:async()=>({choices:[{finish_reason:'length',message:{content:'partial'}}]})}))).rejects.toThrow(/finish/);});
});
describe('Voice input',()=>{
 it('falls back to typing without browser recognition',()=>{expect(speechRecognitionClass({})).toBeNull();expect(()=>startCoachDictation({scope:{}})).toThrow(/Type/);});
 it('produces editable text only and removes callbacks when aborted',()=>{
  let recognizer;class Recognition{constructor(){recognizer=this;}start=vi.fn();stop=vi.fn();abort=vi.fn();}
  const onText=vi.fn(),onError=vi.fn(),onEnd=vi.fn();
  const voice=startCoachDictation({scope:{webkitSpeechRecognition:Recognition},onText,onError,onEnd});
  recognizer.onresult({results:[[{transcript:'Make a chicken lunch'}]]});expect(onText).toHaveBeenCalledWith('Make a chicken lunch');expect(recognizer.lang).toBe('en-ZA');expect(recognizer.continuous).toBe(false);
  voice.stop();expect(recognizer.stop).toHaveBeenCalled();voice.abort();expect(recognizer.abort).toHaveBeenCalled();expect(recognizer.onresult).toBeNull();
 });
});
