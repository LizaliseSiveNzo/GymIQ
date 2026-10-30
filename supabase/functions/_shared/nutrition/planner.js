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
  {id:'apple-yoghurt-oats',slot:'breakfast',name:'Apple & yoghurt oat bowl',items:[item('173904',55),item('170886',180),item('171688',150)]},
  {id:'banana-almond-yoghurt',slot:'breakfast',name:'Banana & almond yoghurt bowl',items:[item('170886',250),item('173944',120),item('170567',25)]},
  {id:'eggs-sweet-potato',slot:'breakfast',name:'Boiled eggs & sweet potato',items:[item('173424',100),item('168484',200),item('170457',100),item('171413',5)]},
  {id:'egg-tomato-sandwich',slot:'breakfast',name:'Egg & tomato breakfast sandwich',items:[item('173424',100),item('172688',80),item('170457',100),item('168409',80)]},
  {id:'apple-almond-yoghurt',slot:'breakfast',name:'Apple, almonds & yoghurt',items:[item('170886',250),item('171688',160),item('170567',25),item('173904',20)]},
  {id:'banana-milk-oats',slot:'breakfast',name:'Banana overnight oats with milk',items:[item('173904',65),item('171267',200),item('173944',100)]},
  {id:'chicken-avo-sandwich',slot:'lunch',name:'Chicken & avocado sandwich',items:[item('171477',130),item('172688',100),item('171705',60),item('170457',100)]},
  {id:'tuna-rice-salad',slot:'lunch',name:'Tuna & brown rice salad',items:[item('173709',130),item('169704',180),item('168409',100),item('170457',100),item('171413',8)]},
  {id:'chicken-sweet-potato-lunch',slot:'lunch',name:'Chicken & sweet potato lunchbox',items:[item('171477',130),item('168484',220),item('170393',100),item('171413',8)]},
  {id:'tuna-bean-salad',slot:'lunch',name:'Tuna, bean & tomato salad',items:[item('173709',120),item('175194',150),item('170457',120),item('168409',100),item('171413',10)]},
  {id:'chicken-lentil-lunch',slot:'lunch',name:'Chicken & lentil bowl',items:[item('171477',100),item('172421',180),item('170393',100),item('170457',100),item('171413',8)]},
  {id:'chicken-veg-toast',slot:'lunch',name:'Chicken, broccoli & wholewheat toast',items:[item('171477',130),item('172688',100),item('169967',150),item('171413',8)]},
  {id:'banana-yoghurt-snack',slot:'snack',name:'Banana & plain yoghurt',items:[item('173944',100),item('170886',150)]},
  {id:'eggs-tomato-snack',slot:'snack',name:'Boiled eggs & tomato',items:[item('173424',100),item('170457',120)]},
  {id:'avo-toast-snack',slot:'snack',name:'Avocado & tomato toast',items:[item('172688',40),item('171705',50),item('170457',60)]},
  {id:'yoghurt-almond-snack',slot:'snack',name:'Plain yoghurt & almonds',items:[item('170886',170),item('170567',15)]},
  {id:'tuna-cucumber-snack',slot:'snack',name:'Tuna & cucumber toast',items:[item('173709',70),item('172688',40),item('168409',80)]},
  {id:'chicken-lentil-dinner',slot:'dinner',name:'Chicken, lentils & broccoli',items:[item('171477',140),item('172421',180),item('169967',160),item('171413',10)]},
  {id:'tuna-sweet-potato',slot:'dinner',name:'Tuna, sweet potato & greens',items:[item('173709',160),item('168484',260),item('169967',180),item('171413',10)]},
  {id:'chicken-bean-rice',slot:'dinner',name:'Chicken, beans & brown rice',items:[item('171477',130),item('175194',130),item('169704',150),item('170457',120),item('171413',8)]},
  {id:'chicken-avo-rice',slot:'dinner',name:'Chicken, avocado & rice plate',items:[item('171477',150),item('169704',180),item('171705',70),item('168409',120),item('170457',100)]},
  {id:'tuna-kidney-bowl',slot:'dinner',name:'Tuna, kidney beans & vegetables',items:[item('173709',150),item('175194',200),item('169967',140),item('170393',100),item('171413',10)]},
  {id:'chicken-sweet-potato-carrot',slot:'dinner',name:'Chicken, sweet potato & carrots',items:[item('171477',150),item('168484',250),item('170393',150),item('170457',100),item('171413',10)]},
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
  return Array.isArray(plan)&&plan.length===SLOTS.length&&SLOTS.every(slot=>plan.filter(m=>m.slot===slot).length===1&&plan.some(m=>{
    if(m.slot!==slot)return false;
    if(m.recipe_id!=='coach-custom')return eligible.some(r=>r.id===m.recipe_id&&r.slot===slot);
    try{
      mealTotals(m.items,foods);
      return m.items.every(i=>{const f=foods.find(f=>f.id===i.food_id);return f&&(diet==='regular'||f[diet]===true)&&!f.allergens.some(a=>excludes.includes(a));})&&
        (diet!=='regular'||!['lunch','dinner'].includes(slot)||m.items.some(i=>foods.find(f=>f.id===i.food_id)?.vegetarian===false));
    }catch{return false;}
  }));
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
export function shufflePlan(current, target, foods, diet='regular', excludes=[], slot='all', random=Math.random) {
  if(slot!=='all'&&!SLOTS.includes(slot))throw new Error('Choose a valid meal to shuffle.');
  if(!planMatchesDiet(current,foods,diet,excludes))throw new Error('Rebuild your plan to match your current preferences first.');
  const eligible=eligibleRecipes(foods,diet,excludes), selection=Object.fromEntries(current.map(m=>[m.slot,m.recipe_id]));
  for(const s of slot==='all'?SLOTS:[slot]){
    const choices=eligible.filter(r=>r.slot===s&&r.id!==selection[s]);
    if(!choices.length)throw new Error(`No different ${s} matches your preferences. Try adjusting your ingredient exclusions.`);
    selection[s]=choices[Math.min(choices.length-1,Math.max(0,Math.floor(random()*choices.length)))].id;
  }
  const generated=buildPlan(target,foods,diet,excludes,selection);
  return current.map(m=>slot==='all'||m.slot===slot?{...generated.find(n=>n.slot===m.slot),selection_method:'shuffle'}:m);
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
