"""Extract the small GymIQ catalogue from USDA SR Legacy CSVs (download URL in docs)."""
import csv,json
from pathlib import Path
root=Path('artifacts/nutrition-source')
spec=[('173904','Oats · dry',['gluten'],True,True),('171267','Milk · 2%',['milk'],True,False),('170886','Plain low-fat yoghurt',['milk'],True,False),('173944','Banana',[],True,True),('171688','Apple · with skin',[],True,True),('173424','Egg · hard-boiled',['egg'],True,False),('172688','Wholewheat bread',['wheat','gluten'],True,True),('169704','Brown rice · cooked',[],True,True),('171477','Chicken breast · cooked',[],False,False),('173709','Tuna · water-packed, drained',['fish'],False,False),('172421','Lentils · cooked, no salt',[],True,True),('175194','Kidney beans · cooked, no salt',[],True,True),('172475','Firm tofu',['soy'],True,True),('169967','Broccoli · cooked',[],True,True),('170393','Carrot · raw',[],True,True),('170457','Tomato · raw',[],True,True),('168409','Cucumber · raw',[],True,True),('168484','Sweet potato · boiled',[],True,True),('171413','Olive oil',[],True,True),('170567','Almonds',['nuts'],True,True),('171705','Avocado',[],True,True)]
# Meat additions retain exact USDA preparation states; never substitute lamb for mutton.
meats=[
 ('167634','Mutton · roasted (USDA estimate)'),
 ('171098','Turkey breast · skinless, raw'),('171496','Turkey breast · skinless, roasted'),
 ('172850','Turkey mince · 7% fat, raw'),('172851','Turkey mince · 7% fat, pan-cooked'),
 ('171790','Beef mince · 5% fat, raw'),('174028','Beef mince · 5% fat, pan-cooked'),
 ('174030','Beef mince · 10% fat, raw'),('171794','Beef mince · 10% fat, pan-cooked'),
 ('174036','Beef mince · 20% fat, raw'),('171799','Beef mince · 20% fat, pan-cooked'),
 ('174370','Lamb mince · raw'),('172544','Lamb mince · cooked, grilled'),('174314','Lamb leg · lean, roasted'),
 ('167902','Pork mince · raw'),('167903','Pork mince · cooked'),
 ('168249','Pork fillet · lean, raw'),('168250','Pork fillet · lean, roasted'),
 ('171116','Chicken mince · raw'),('171117','Chicken mince · pan-cooked'),('172388','Chicken thigh · skinless, roasted'),
 ('172173','Beef sirloin · lean, raw'),('172170','Beef sirloin · lean, grilled'),
 ('175303','Goat · raw'),('175304','Goat · roasted'),
 ('173855','Venison (deer) · raw'),('175085','Venison (deer) · roasted'),
 ('174618','Beef sausage · cooked (generic)'),('174579','Pork & beef sausage · cooked (generic)'),
 ('174617','Turkey sausage · raw (generic)'),('173871','Turkey sausage · cooked (generic)'),
]
# Generic sausage recipes vary. Exclude conservatively for possible binders.
sausage_ids={'174618','174579','174617','173871'}
spec += [(i,name,['wheat','gluten','milk','soy','egg'] if i in sausage_ids else [],False,False) for i,name in meats]
foods={r['fdc_id']:r for r in csv.DictReader((root/'food.csv').open(encoding='utf-8'))}
nutrients={i:{} for i,*_ in spec}
for r in csv.DictReader((root/'food_nutrient.csv').open(encoding='utf-8')):
 if r['fdc_id'] in nutrients and r['nutrient_id'] in ['1008','1003','1004','1005']:nutrients[r['fdc_id']][r['nutrient_id']]=float(r['amount'])
out=[]
for i,name,allergens,vegetarian,vegan in spec:
 n=nutrients[i]
 assert len(n)==4,(i,n)
 out.append(dict(id=i,name=name,kcal=n['1008'],protein=n['1003'],fat=n['1004'],carbs=n['1005'],allergens=allergens,vegetarian=vegetarian,vegan=vegan,source_description=foods[i]['description'],source_url=f'https://fdc.nal.usda.gov/food-details/{i}/nutrients'))
for food in out:
 if food['id'] in sausage_ids: food['allergen_note']='Generic recipe: wheat, milk, soy or egg binders may vary by product; exclusion tags are conservative. Use the package or barcode for a specific brand.'
assert len({f['id'] for f in out})==len(out),'Duplicate catalogue IDs'
Path('supabase/functions/_shared/nutrition/foods.json').write_text(json.dumps(out,indent=2)+'\n',encoding='utf-8')
print(f'Extracted {len(out)} foods with verified energy and macros')
