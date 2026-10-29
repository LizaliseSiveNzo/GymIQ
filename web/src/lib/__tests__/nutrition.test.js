import {describe,it,expect} from 'vitest';
import foods from '../../../../supabase/functions/_shared/nutrition/foods.json';
import {calorieGuide,mealTotals,buildPlan,eligibleRecipes,periodSummary} from '../../../../supabase/functions/_shared/nutrition/planner.js';
const base={sex:'male',age:30,height_cm:180,weight_kg:85,goal_weight_kg:78,monthly_loss_kg:1,activity_level:'sedentary',gym_days:3,gym_minutes:60,gym_basis:'planned',general_plan:true};
describe('nutrition planning boundaries',()=>{
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
