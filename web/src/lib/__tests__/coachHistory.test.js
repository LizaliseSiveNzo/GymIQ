import {describe,it,expect} from 'vitest';
import foods from '../../../../supabase/functions/_shared/nutrition/foods.json';
import {buildCoachHistory,loadCoachHistory} from '../../../../supabase/functions/_shared/coachHistory.js';
const day='2026-11-03',session=(id,date='2026-11-02T10:00:00Z',patch={})=>({id,completed_at:date,duration_sec:1800,coach_readiness:'ready',excluded_exercises:[],...patch});
const row=(id,log='new',patch={})=>({id,log_id:log,exercise_id:'squat',exercise_name:'Squat',completed_at:log==='old'?'2026-10-26T10:00:00Z':'2026-11-02T10:00:00Z',weight:40,reps:8,completed:true,set_type:'normal',...patch});
const records=(patch={})=>({sessions:[session('new'),session('old','2026-10-26T10:00:00Z')],food:[],weights:[],targets:[],feedback:[],rest:[],savedMeals:[],muscles:[],foodPeriod0:[],foodPeriod7:[],foodPeriod14:[],foodPeriod21:[],...patch});
const build=patch=>buildCoachHistory({day,offset:-120,records:records(),foods,...patch});
describe('Account-scoped personal coach history',()=>{
 it('compares actual paired sets without presenting saved targets as achieved',()=>{
  const h=build({records:records({targets:[{exercise_name:'Squat',weight:200,reps:20}]}),progress:[row('1','new',{weight:45,reps:6,weight_left:40,reps_left:8,rir:2}),row('2','old')]});
  expect(h.training.finished_sessions_loaded_last7).toBe(1);expect(h.training.finished_sessions_loaded_previous7).toBe(1);
  expect(h.training.exercises[0].latest_sessions[0].sets[0]).toMatchObject({kg:45,reps:6,left_kg:40,left_reps:8,rir:2});
  expect(h.training.saved_targets_are_not_performed[0].kg).toBe(200);expect(JSON.stringify(h.training.exercises)).not.toContain('200');
 });
 it('excludes cancelled, unfinished, warmup, removed and duplicate records',()=>{
  const h=build({records:records({sessions:[session('new',undefined,{excluded_exercises:['nm_Removed']}),session('cancel',undefined,{cancelled_at:'today'})]}),progress:[row('good'),row('good'),row('warm','new',{set_type:'warmup'}),row('unchecked','new',{completed:false}),row('removed','new',{exercise_name:'Removed'}),row('draft','missing'),row('cancelled','cancel')]});
  expect(h.training.working_sets_loaded_28d).toBe(1);expect(h.training.exercises).toHaveLength(1);
 });
 it('uses effort ratings only for working exercises that remain in a finished workout',()=>{
  const h=build({progress:[row('one')],records:records({feedback:[{log_id:'new',exercise_id:'squat',exercise_name:'Squat',effort:'hard'},{log_id:'new',exercise_id:'removed',exercise_name:'Removed',effort:'easy'},{log_id:'draft',exercise_id:'squat',effort:'hard'}]})});
  expect(h.training.recent_effort).toEqual([{exercise:'Squat',effort:'hard',day:'2026-11-02'}]);
 });
 it('treats empty and partial food days as unknown and preserves dated calorie guides',()=>{
  const h=build({records:records({foodPeriod0:[{day,kcal:0,entries:0,complete:false,target:2100},{day:'2026-11-02',kcal:1800,entries:3,complete:true,target:2000}],foodPeriod7:[{day:'2026-10-27',kcal:1900,entries:4,complete:true,target:1950}]})});
  expect(h.nutrition.days.find(d=>d.day===day).logged_kcal).toBeNull();expect(h.nutrition.average_kcal_complete_days_only).toBe(1850);
  expect(h.nutrition.days.find(d=>d.day==='2026-10-27').dated_guide_kcal).toBe(1950);
 });
 it('calculates known logged macros and leaves calorie-only food macros unknown',()=>{
  const chicken=foods.find(f=>f.id==='171477');
  const h=build({records:records({food:[{log_day:day,label:'Chicken',kcal:-330,meal_snapshot:{items:[{food_id:chicken.id,grams:200}]}},{log_day:day,label:'Extra snack',kcal:-200}]})});
  expect(h.nutrition.recent_logged_meals[0].macros.protein_g).toBeCloseTo(chicken.protein*2,1);expect(h.nutrition.recent_logged_meals[1].macros).toBeNull();
 });
 it('separates planned/saved meals from intake and requested goals from modelled estimates',()=>{
  const h=build({goal:{settings:{monthly_loss_kg:4,goal_weight_kg:75},result:{target:2200,monthly_loss_kg:1.9}},plan:{target:2200,plan:[{name:'Lunch',slot:'lunch',kcal:550,items:[]}]},records:records({savedMeals:[{name:'Favourite',slot:'lunch',items:[]}]})});
  expect(h.nutrition.recent_logged_meals).toEqual([]);expect(h.nutrition.todays_plan_not_intake.meals[0].name).toBe('Lunch');expect(h.goal).toMatchObject({requested_monthly_loss_kg:4,modelled_monthly_loss_kg:1.9});
 });
 it('uses local dates near midnight and only compares adequately sampled weight weeks',()=>{
  const h=build({records:records({sessions:[session('new','2026-11-02T23:00:00Z')],weights:[{metric_date:'2026-11-03',weight_kg:80},{metric_date:'2026-11-02',weight_kg:80.2},{metric_date:'2026-11-02',weight_kg:150},{metric_date:'2026-10-27',weight_kg:81},{metric_date:'2026-10-26',weight_kg:81.2}]}),progress:[row('one','new',{completed_at:'2026-11-02T23:00:00Z'})]});
  expect(h.training.sessions[0].day).toBe(day);expect(h.weight.checkins).toHaveLength(4);expect(h.weight.observed_weekly_change_kg).toBe(-1);
  expect(build({records:records({weights:[{metric_date:day,weight_kg:80}]})}).weight.observed_weekly_change_kg).toBeNull();
 });
 it('marks unavailable and truncated data instead of inventing complete coverage',()=>{
  const h=build({records:records({sessions:null,food:Array(41).fill({log_day:day,kcal:-1,label:'Food'})}),progress:Array(500).fill(row('one'))});
  expect(h.coverage.unavailable_sections).toContain('sessions');expect(h.training.finished_sessions_loaded_28d).toBeNull();expect(h.coverage.training_sample_may_be_truncated).toBe(true);expect(h.nutrition.recent_logged_meals).toHaveLength(40);
 });
 it('does not forward identities, private notes, raw snapshots or unrelated measurements',()=>{
  const secret='private-fixture-only';const h=build({goal:{settings:{email:secret,age:secret,sex:secret,height_cm:secret}},records:records({sessions:[session('new',undefined,{note:secret,user_id:secret})],weights:[{metric_date:day,weight_kg:80,note:secret,body_fat_pct:secret}],food:[{log_day:day,kcal:-50,meal_snapshot:{note:secret}}]}),progress:[row('one','new',{client_id:secret,note:secret})]});
  expect(JSON.stringify(h)).not.toContain(secret);
 });
 it('applies explicit owner filters to every personal table and handles optional failures',async()=>{
  const calls=[];const db={from(table){const entry={table,filters:[]};calls.push(entry);const q={};for(const method of ['select','eq','not','is','gte','lte','order','limit'])q[method]=(...args)=>{entry.filters.push([method,...args]);return q;};q.then=resolve=>resolve(table==='body_metrics'?{error:Error('private diagnostic')}:{data:[]});return q;},rpc(name,args){calls.push({rpc:name,args});return Promise.resolve({data:[]});}};
  const loaded=await loadCoachHistory(db,{userId:'owner',day,offset:-120});expect(loaded.weights).toBeNull();
  for(const entry of calls.filter(c=>c.table&&c.table!=='muscles'))expect(entry.filters.some(f=>f[0]==='eq'&&['user_id','client_id'].includes(f[1])&&f[2]==='owner')).toBe(true);
  expect(calls.filter(c=>c.rpc).every(c=>c.args.p_offset===-120)).toBe(true);
 });
});
