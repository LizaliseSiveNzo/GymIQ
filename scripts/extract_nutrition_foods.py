"""Extract the small GymIQ catalogue from USDA SR Legacy CSVs (download URL in docs)."""
import csv,json
from pathlib import Path
root=Path('artifacts/nutrition-source')
spec=[('173904','Oats · dry',['gluten'],True,True),('171267','Milk · 2%',['milk'],True,False),('170886','Plain low-fat yoghurt',['milk'],True,False),('173944','Banana',[],True,True),('171688','Apple · with skin',[],True,True),('173424','Egg · hard-boiled',['egg'],True,False),('172688','Wholewheat bread',['wheat','gluten'],True,True),('169704','Brown rice · cooked',[],True,True),('171477','Chicken breast · cooked',[],False,False),('173709','Tuna · water-packed, drained',['fish'],False,False),('172421','Lentils · cooked, no salt',[],True,True),('175194','Kidney beans · cooked, no salt',[],True,True),('172475','Firm tofu',['soy'],True,True),('169967','Broccoli · cooked',[],True,True),('170393','Carrot · raw',[],True,True),('170457','Tomato · raw',[],True,True),('168409','Cucumber · raw',[],True,True),('168484','Sweet potato · boiled',[],True,True),('171413','Olive oil',[],True,True),('170567','Almonds',['nuts'],True,True),('171705','Avocado',[],True,True)]
foods={r['fdc_id']:r for r in csv.DictReader((root/'food.csv').open(encoding='utf-8'))}
nutrients={i:{} for i,*_ in spec}
for r in csv.DictReader((root/'food_nutrient.csv').open(encoding='utf-8')):
 if r['fdc_id'] in nutrients and r['nutrient_id'] in ['1008','1003','1004','1005']:nutrients[r['fdc_id']][r['nutrient_id']]=float(r['amount'])
out=[]
for i,name,allergens,vegetarian,vegan in spec:
 n=nutrients[i]
 assert len(n)==4,(i,n)
 out.append(dict(id=i,name=name,kcal=n['1008'],protein=n['1003'],fat=n['1004'],carbs=n['1005'],allergens=allergens,vegetarian=vegetarian,vegan=vegan,source_description=foods[i]['description'],source_url=f'https://fdc.nal.usda.gov/food-details/{i}/nutrients'))
Path('supabase/functions/_shared/nutrition/foods.json').write_text(json.dumps(out,indent=2)+'\n',encoding='utf-8')
print(f'Extracted {len(out)} foods with verified energy and macros')
