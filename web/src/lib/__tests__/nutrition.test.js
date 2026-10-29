import {describe,it,expect} from 'vitest';
import foods from '../../../../supabase/functions/_shared/nutrition/foods.json';
import {calorieGuide,mealTotals,buildPlan,eligibleRecipes,periodSummary,planMatchesDiet,shufflePlan,RECIPES,SLOTS} from '../../../../supabase/functions/_shared/nutrition/planner.js';
const base={sex:'male',age:30,height_cm:180,weight_kg:85,goal_weight_kg:78,monthly_loss_kg:1,activity_level:'sedentary',gym_days:3,gym_minutes:60,gym_basis:'planned',general_plan:true};
describe('nutrition planning boundaries',()=>{
 it('offers eight default meals per slot with unique recipe IDs and valid source ingredients',()=>{
  expect(new Set(RECIPES.map(r=>r.id)).size).toBe(RECIPES.length);
  for(const slot of SLOTS)expect(eligibleRecipes(foods).filter(r=>r.slot===slot)).toHaveLength(8);
  for(const recipe of RECIPES){expect(recipe.items.length).toBeLessThanOrEqual(6);expect(mealTotals(recipe.items,foods).kcal).toBeGreaterThan(0);}
 });
 it('changes all four choices while preserving the calorie guide and mixed-meal policy',()=>{
  const old=buildPlan(2300,foods,'regular',[]);
  const next=shufflePlan(old,2300,foods,'regular',[],'all',()=>.5);
  expect(next.every((m,i)=>m.recipe_id!==old[i].recipe_id)).toBe(true);
  expect(planMatchesDiet(next,foods)).toBe(true);
  expect(Math.abs(next.reduce((n,m)=>n+m.kcal,0)-2300)).toBeLessThan(20);
  expect(old.every(m=>!m.selection_method)).toBe(true);
 });
 it('shuffles a single slot without changing any other cards or portions',()=>{
  const old=buildPlan(2000,foods,'regular',[]),next=shufflePlan(old,2000,foods,'regular',[],'lunch',()=>0);
  expect(next[1].recipe_id).not.toBe(old[1].recipe_id);
  for(const i of [0,2,3])expect(next[i]).toBe(old[i]);
  expect(shufflePlan(next,2000,foods,'regular',[],'lunch',()=>0)[1].recipe_id).not.toBe(next[1].recipe_id);
 });
 it('honours exclusions and explicit vegan preferences during shuffle',()=>{
  const old=buildPlan(2000,foods,'vegan',['soy']),next=shufflePlan(old,2000,foods,'vegan',['soy'],'snack',()=>.9);
  expect(planMatchesDiet(next,foods,'vegan',['soy'])).toBe(true);
  expect(next[2].recipe_id).not.toBe(old[2].recipe_id);
 });
 it('explains unavailable alternatives and rejects invalid shuffle slots',()=>{
  const old=buildPlan(2000,foods,'vegan',['soy']);
  expect(()=>shufflePlan(old,2000,foods,'vegan',['soy'],'breakfast')).toThrow('No different breakfast');
  expect(()=>shufflePlan(old,2000,foods,'vegan',['soy'],'supper')).toThrow('valid meal');
  expect(()=>shufflePlan(old,2000,foods,'regular',[])).toThrow('Rebuild');
 });
 it('keeps vegetarian main meals out of default presets and overrides incompatible AI choices',()=>{
  const allowed=eligibleRecipes(foods);
  for(const id of ['bean-bowl','lentil-rice','tofu-bowl','plant-oats'])expect(allowed.some(r=>r.id===id)).toBe(false);
  const plan=buildPlan(2200,foods,'regular',[],{lunch:'bean-bowl',dinner:'lentil-rice'});
  for(const m of plan.filter(m=>['lunch','dinner'].includes(m.slot)))expect(m.items.some(i=>foods.find(f=>f.id===i.food_id).vegetarian===false)).toBe(true);
  expect(planMatchesDiet(plan,foods)).toBe(true);
 });
 it('allows vegetarian mains only with an explicit preference, and catches old incompatible plans',()=>{
  const plan=buildPlan(2200,foods,'vegetarian',[],{lunch:'bean-bowl',dinner:'lentil-rice'});
  expect(planMatchesDiet(plan,foods,'vegetarian')).toBe(true);
  expect(planMatchesDiet(plan,foods,'regular')).toBe(false);
  expect(plan.find(m=>m.slot==='dinner').recipe_id).toBe('lentil-rice');
 });
 it('does not silently substitute plant mains when animal options are excluded',()=>{
  // Current dinner catalogue includes chicken even if fish is excluded.
  expect(buildPlan(2000,foods,'regular',['fish']).find(m=>m.slot==='dinner').recipe_id).toBe('chicken-potato');
 });
 it('uses net gym energy once and a 30-day requested deficit',()=>{
  const r=calorieGuide(base);expect(r.bmr).toBe(1830);expect(r.gym_kcal).toBe(91);expect(r.maintenance).toBe(2287);expect(r.target).toBe(2030);
 });
 it('caps ambitious requests rather than promising requested loss',()=>{const r=calorieGuide({...base,monthly_loss_kg:4});expect(r.target).toBeGreaterThanOrEqual(r.bmr);expect(r.maintenance-r.target).toBeLessThanOrEqual(500);expect(r.monthly_loss_kg).toBeLessThan(4);});
 it('uses recorded weekly minutes without adding the planned schedule again',()=>{expect(calorieGuide({...base,gym_basis:'recorded'},180)).toEqual({...calorieGuide(base),gym_basis:'recorded'});});
 it('supports maintenance without secretly applying a loss deficit',()=>{const r=calorieGuide({...base,monthly_loss_kg:0});expect(r.target).toBe(r.maintenance);});
 it('rejects minors, missing numbers, unsupported estimates and underweight goals',()=>{
  for(const s of [{age:16},{height_cm:''},{weight_kg:NaN},{goal_weight_kg:40},{general_plan:false},{monthly_loss_kg:5},{sex:'other'},{age:85,sex:'female',height_cm:130,weight_kg:35,goal_weight_kg:35,monthly_loss_kg:0,gym_days:0}])expect(()=>calorieGuide({...base,...s})).toThrow();
 });
 it('calculates from source energy per 100g, not rounded recipe claims',()=>{const r=mealTotals([{food_id:'173944',grams:150}],foods);expect(r.kcal).toBe(133.5);});
 it('rejects unknown foods and invalid quantities',()=>{for(const items of [[],[{food_id:'fake',grams:100}],[{food_id:'173944',grams:-1}],[{food_id:'173944',grams:1501}],[{food_id:'173944',grams:Infinity}]])expect(()=>mealTotals(items,foods)).toThrow();});
 it('scales all four meal slots close to the guide without inventing nutrients',()=>{
  const plan=buildPlan(2030,foods,'regular',[]);expect(plan).toHaveLength(4);expect(Math.abs(plan.reduce((s,m)=>s+m.kcal,0)-2030)).toBeLessThan(15);
  for(const m of plan)expect(mealTotals(m.items,foods)).toEqual({kcal:m.kcal,protein:m.protein,carbs:m.carbs,fat:m.fat});
 });
 it('applies diet and ingredient exclusions locally even if AI picks an incompatible meal',()=>{
  const plan=buildPlan(2000,foods,'vegan',['soy'],{breakfast:'eggs-toast',lunch:'chicken-bowl',snack:'fruit-yoghurt',dinner:'tofu-bowl'});
  for(const m of plan)for(const i of m.items){const f=foods.find(f=>f.id===i.food_id);expect(f.vegan).toBe(true);expect(f.allergens).not.toContain('soy');}
 });
 it('fails clearly when exclusions leave no complete plan',()=>{expect(eligibleRecipes(foods,'vegan',['gluten','nuts'])).not.toHaveLength(0);expect(()=>buildPlan(2000,foods,'vegan',['gluten','nuts'])).toThrow();});
 it('counts missing guides and incomplete days explicitly',()=>{
  expect(periodSummary([{day:'2026-10-28',kcal:0,entries:0,target:null,complete:false},{day:'2026-10-29',kcal:500,entries:1,target:2000,complete:false}],'2026-10-28','2026-10-29')).toEqual({logged:500,loggedDays:1,completeDays:0,guide:2000,guideDays:1,days:2});
 });
});
