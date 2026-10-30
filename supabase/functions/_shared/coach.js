import {mealTotals,SLOTS} from './nutrition/planner.js';

const int=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
const title=(text,max=100)=>{if(typeof text!=='string'||!text.trim()||text.length>max)throw Error('Use a short, clear name.');return text.trim();};
export function validateKitchen(settings,foods,equipment) {
  if(!settings||!Array.isArray(settings.pantry)||!Array.isArray(settings.equipment))throw Error('Save your ingredients and equipment first.');
  if(settings.pantry.some(id=>!foods.some(f=>f.id===id))||settings.equipment.some(id=>!equipment.some(e=>e.id===id)))throw Error('Update your ingredient and equipment selections.');
  return {pantry:[...new Set(settings.pantry)],equipment:[...new Set(settings.equipment)]};
}
export function validateMeal(input,context) {
  const {foods,kitchen,diet='regular',excludes=[]}=context;
  if(!SLOTS.includes(input?.slot))throw Error('Choose breakfast, lunch, snack or dinner.');
  if(!Array.isArray(input.items)||input.items.length<1||input.items.length>12)throw Error('Use between one and twelve ingredients.');
  const seen=new Set();
  const items=input.items.map(i=>{
    const food=foods.find(f=>f.id===i.food_id);
    if(!food||!kitchen.pantry.includes(food.id)||seen.has(food.id))throw Error('Use each available catalogue ingredient once per meal.');
    seen.add(food.id);
    if((diet!=='regular'&&!food[diet])||food.allergens.some(a=>excludes.includes(a)))throw Error('This meal conflicts with your saved diet or exclusions.');
    if(typeof i.grams!=='number'||!Number.isFinite(i.grams)||i.grams<1||i.grams>1000)throw Error('Use ingredient portions from 1 to 1,000 grams.');
    return {food_id:food.id,grams:Math.round(i.grams*10)/10};
  });
  if(diet==='regular'&&['lunch','dinner'].includes(input.slot)&&!items.some(i=>foods.find(f=>f.id===i.food_id).vegetarian===false))throw Error('Mixed lunch and dinner meals need meat or fish. Select vegetarian in Monthly goal if that is your preference.');
  const totals=mealTotals(items,foods);
  if(totals.kcal<50||totals.kcal>2200)throw Error('Please choose realistic meal portions.');
  return {name:title(input.name),slot:input.slot,items,...totals,recipe_id:'coach-custom',preparation:title(input.preparation,800)};
}
export function validateMealPlan(input,context) {
  const target=Number(context.target);
  if(!int(target,1500,6000))throw Error('Save an eligible Monthly goal before creating a daily plan.');
  if(!Array.isArray(input?.meals)||input.meals.length!==4||!SLOTS.every(s=>input.meals.filter(m=>m.slot===s).length===1))throw Error('A daily plan needs breakfast, lunch, snack and dinner.');
  const draft=input.meals.map(m=>validateMeal(m,context));
  const factor=target/draft.reduce((sum,m)=>sum+m.kcal,0);
  if(factor<0.5||factor>2)throw Error('Meal portions need to be closer to the saved daily guide.');
  const meals=draft.map(m=>validateMeal({...m,items:m.items.map(i=>({...i,grams:Math.round(i.grams*factor*10)/10}))},context));
  if(Math.abs(meals.reduce((n,m)=>n+m.kcal,0)-target)>target*.02)throw Error('Could not balance the portions.');
  return {day:context.day,target,meals};
}
export function validateWorkout(input,context) {
  if(!['hypertrophy','strength','both'].includes(input?.goal)||!int(input.session_minutes,20,90))throw Error('Choose a supported goal and a 20–90 minute session.');
  if(!Array.isArray(input.days)||input.days.length<1||input.days.length>6)throw Error('Plan one to six training days.');
  const days=input.days.map((d,index)=>{
    if(!Array.isArray(d.exercises)||d.exercises.length<2||d.exercises.length>8)throw Error('Use two to eight exercises per workout.');
    const seen=new Set();let sets=0;
    const exercises=d.exercises.map((x,sort)=>{
      const e=context.exercises.find(e=>e.id===x.exercise_id);
      if(!e||seen.has(e.id)||!(e.equipment_ids||[]).every(id=>id==='bodyweight'||context.kitchen.equipment.includes(id)))throw Error('Choose unique library exercises that match your available equipment.');
      seen.add(e.id);
      if(!int(x.sets,1,4)||!int(x.rep_min,5,20)||!int(x.rep_max,x.rep_min,20)||!int(x.rest_seconds,45,180))throw Error('Use 1–4 sets, 5–20 reps and 45–180 seconds of rest.');
      sets+=x.sets;
      return {exerciseId:e.id,name:e.name,sets:x.sets,repMin:x.rep_min,repMax:x.rep_max,rir:2,restSeconds:x.rest_seconds,pattern:e.movement_pattern,sort};
    });
    if(sets>24)throw Error('Keep each workout to at most 24 working sets.');
    return {dayIndex:index,label:String.fromCharCode(65+index),name:title(d.name,70),exercises};
  });
  return {name:title(input.name),generated:{goal:input.goal,split:'full_body',daysPerWeek:days.length,sessionMinutes:input.session_minutes,deloadPolicy:'every_4w',weeks:Array.from({length:8},(_,i)=>({weekNumber:i+1,kind:(i+1)%4===0?'deload':'accumulate',volumeMultiplier:(i+1)%4===0?.5:1})),days}};
}
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const string={type:'string'},integer={type:'integer'};
const meal=object({name:string,slot:{type:'string',enum:SLOTS},preparation:{type:'string',description:'Short preparation instructions. Honour raw/cooked food states. No added unlisted ingredients.'},items:{type:'array',items:object({food_id:string,grams:{type:'number'}})}});
export const COACH_TOOLS=[
  {type:'function',function:{name:'draft_meal',description:'Prepare one custom meal from the saved available ingredients, for review and saving to Meal builder. Never logs intake.',parameters:meal}},
  {type:'function',function:{name:'draft_meal_plan',description:'Prepare four custom meals for today. GymIQ balances portions to the saved calorie guide. Needs a saved goal.',parameters:object({meals:{type:'array',items:meal}})}},
  {type:'function',function:{name:'draft_workout',description:'Prepare a replacement training programme using only library exercises and available equipment. User reviews and applies; keeps completed history.',parameters:object({name:string,goal:{type:'string',enum:['hypertrophy','strength','both']},session_minutes:integer,days:{type:'array',items:object({name:string,exercises:{type:'array',items:object({exercise_id:string,sets:integer,rep_min:integer,rep_max:integer,rest_seconds:integer})}})}})}},
];
export function validateTool(name,args,context) {
  if(name==='draft_meal')return {kind:'meal',payload:validateMeal(args,context)};
  if(name==='draft_meal_plan')return {kind:'meal_plan',payload:validateMealPlan(args,context)};
  if(name==='draft_workout')return {kind:'workout',payload:validateWorkout(args,context)};
  throw Error('This action is not supported.');
}
