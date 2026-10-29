// General adult planning estimates, never a medical prescription.
export const SLOTS = ['breakfast', 'lunch', 'snack', 'dinner'];
const item = (food_id, grams) => ({ food_id, grams });
export const RECIPES = [
  {id:'oat-bowl',slot:'breakfast',name:'Banana, oats & yoghurt',items:[item('173904',55),item('170886',170),item('173944',100)]},
  {id:'eggs-toast',slot:'breakfast',name:'Eggs on wholewheat toast',items:[item('173424',100),item('172688',80),item('170457',100),item('171705',40)]},
  {id:'plant-oats',slot:'breakfast',name:'Apple & almond oats',items:[item('173904',60),item('171688',150),item('170567',25)]},
  {id:'chicken-bowl',slot:'lunch',name:'Chicken & brown rice bowl',items:[item('171477',130),item('169704',170),item('169967',120),item('170393',80),item('171413',8)]},
  {id:'bean-bowl',slot:'lunch',name:'Beans, rice & avocado bowl',items:[item('175194',170),item('169704',150),item('170457',100),item('168409',100),item('171705',60)]},
  {id:'tuna-toast',slot:'lunch',name:'Tuna & avocado toast',items:[item('173709',120),item('172688',100),item('171705',60),item('170457',100),item('168409',100)]},
  {id:'fruit-yoghurt',slot:'snack',name:'Apple & plain yoghurt',items:[item('171688',150),item('170886',170)]},
  {id:'fruit-nuts',slot:'snack',name:'Apple & almonds',items:[item('171688',150),item('170567',25)]},
  {id:'banana-oats',slot:'snack',name:'Banana & oats',items:[item('173944',120),item('173904',30)]},
  {id:'chicken-potato',slot:'dinner',name:'Chicken, sweet potato & greens',items:[item('171477',150),item('168484',250),item('169967',180),item('171413',10)]},
  {id:'tuna-rice',slot:'dinner',name:'Tuna, brown rice & vegetables',items:[item('173709',160),item('169704',200),item('169967',150),item('170393',100),item('171413',10)]},
  {id:'lentil-rice',slot:'dinner',name:'Lentils, rice & vegetables',items:[item('172421',230),item('169704',150),item('169967',150),item('170393',100),item('171413',10)]},
  {id:'tofu-bowl',slot:'dinner',name:'Tofu, rice & vegetables',items:[item('172475',160),item('169704',170),item('169967',150),item('170393',100),item('171413',8)]},
];
export function mealTotals(items, foods) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 30) throw new Error('Choose between 1 and 30 ingredients.');
  const totals={kcal:0,protein:0,carbs:0,fat:0};
  for(const i of items){
    const f=foods.find(f=>f.id===i.food_id), grams=Number(i.grams);
    if(!f||!Number.isFinite(grams)||grams<1||grams>1500)throw new Error('Each ingredient needs 1–1,500 grams.');
    for(const k of Object.keys(totals))totals[k]+=f[k]*grams/100;
  }
  return Object.fromEntries(Object.entries(totals).map(([k,v])=>[k,Math.round(v*10)/10]));
}
export function eligibleRecipes(foods, diet='regular', excludes=[]) {
  return RECIPES.filter(r=>{
    // Mixed eating is the default. Plant-based main dishes require explicit opt-in.
    if(diet==='regular' && (r.id==='plant-oats'||(['lunch','dinner'].includes(r.slot)&&!r.items.some(i=>foods.find(f=>f.id===i.food_id)?.vegetarian===false))))return false;
    return r.items.every(i=>{
    const f=foods.find(f=>f.id===i.food_id);
    return f && (diet==='regular'||f[diet]===true) && !f.allergens.some(a=>excludes.includes(a));
    });
  });
}
export function planMatchesDiet(plan, foods, diet='regular', excludes=[]) {
  const eligible=eligibleRecipes(foods,diet,excludes);
  return Array.isArray(plan)&&plan.length===SLOTS.length&&SLOTS.every(slot=>plan.some(m=>m.slot===slot&&eligible.some(r=>r.id===m.recipe_id&&r.slot===slot)));
}
export function buildPlan(target, foods, diet, excludes, selection={}) {
  if(!Number.isFinite(target)||target<1500||target>6000)throw new Error('Set an eligible calorie guide first.');
  const eligible=eligibleRecipes(foods,diet,excludes), shares=[.25,.3,.1,.35];
  return SLOTS.map((slot,index)=>{
    const choices=eligible.filter(r=>r.slot===slot);
    const r=choices.find(r=>r.id===selection[slot])||choices[0];
    if(!r)throw new Error(`No ${slot} preset matches your exclusions. Build your own meal instead.`);
    const factor=target*shares[index]/mealTotals(r.items,foods).kcal;
    const items=r.items.map(i=>({...i,grams:Math.max(1,Math.round(i.grams*factor))}));
    const totals=mealTotals(items,foods);
    return {slot,name:r.name,recipe_id:r.id,items,...totals};
  });
}
export function calorieGuide(s, recordedMinutesPerWeek=0) {
  const age=Number(s.age),h=Number(s.height_cm),w=Number(s.weight_kg),goal=Number(s.goal_weight_kg),loss=Number(s.monthly_loss_kg);
  const activity={sedentary:1.2,light:1.375,moderate:1.55}[s.activity_level];
  const days=Number(s.gym_days),minutes=Number(s.gym_minutes);
  if(!['male','female'].includes(s.sex)||age<18||age>85||h<130||h>230||w<35||w>300||goal<35||goal>300||loss<0||loss>4||![age,h,w,goal,loss,days,minutes].every(Number.isFinite)||!activity||days<0||days>7||minutes<0||minutes>180)throw new Error('Check the measurements and gym schedule. This planner is for adults aged 18–85.');
  if(loss>0&&(goal>=w||goal/(h/100)**2<18.5||w/(h/100)**2<18.5))throw new Error('Choose a lower goal weight within the general adult BMI range, or choose maintenance (0 kg/month).');
  if(s.general_plan!==true)throw new Error('Confirm this general adult planner is appropriate, or continue logging food without a plan.');
  const bmr=10*w+6.25*h-5*age+(s.sex==='male'?5:-161);
  const gymWeek=s.gym_basis==='recorded'?recordedMinutesPerWeek:days*minutes;
  // Net of resting energy; non-gym activity must exclude these sessions.
  const gymKcal=Math.round(2.5*w*gymWeek/60/7);
  const maintenance=Math.round(bmr*activity+gymKcal);
  const floor=Math.max(1500,Math.ceil(bmr));
  const deficit=Math.max(0,Math.min(loss*7700/30,500,maintenance*.25,maintenance-floor));
  const target=Math.round(maintenance-deficit);
  if(target<1500||target>6000)throw new Error('Your estimated needs are outside this general planner. Use food logging and seek an individual plan.');
  return {bmr:Math.round(bmr),maintenance,target,gym_kcal:gymKcal,monthly_loss_kg:Math.round(deficit*30/7700*100)/100,requested_loss_kg:loss,gym_basis:s.gym_basis==='recorded'?'recorded':'planned'};
}
export function localDay(date=new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function periodSummary(days, start, end) {
  const included=days.filter(d=>d.day>=start&&d.day<=end);
  return {logged:included.reduce((n,d)=>n+Number(d.kcal),0),loggedDays:included.filter(d=>d.entries>0).length,completeDays:included.filter(d=>d.complete).length,guide:included.reduce((n,d)=>n+Number(d.target||0),0),guideDays:included.filter(d=>d.target>0).length,days:included.length};
}
