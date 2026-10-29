export function validBarcode(value){
 if(!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(String(value)))return false;
 const digits=String(value).split('').map(Number),check=digits.pop();
 const sum=digits.reverse().reduce((n,d,i)=>n+d*(i%2===0?3:1),0);
 return (10-sum%10)%10===check;
}
export function normalizeBarcodeProduct(data,barcode){
 const p=data?.product;if(!p)return null;
 const aggregate=p.nutrition?.aggregated_set;
 let kcal,unit=null;
 if(aggregate){
  if(!['100g','100ml'].includes(aggregate.per)||aggregate.preparation!=='as_sold')return null;
  const energy=aggregate.nutrients?.['energy-kcal'],kj=aggregate.nutrients?.['energy-kj']||aggregate.nutrients?.energy;
  if(energy?.modifier||kj?.modifier)return null;
  if(energy?.value!=null&&String(energy.unit).toLowerCase()==='kcal')kcal=energy.value;
  else if(kj?.value!=null&&String(kj.unit).toLowerCase()==='kj')kcal=Number(kj.value)/4.184;
  unit=aggregate.per==='100ml'?'ml':'g';
 }else{
  const n=p.nutriments;if(!n)return null;kcal=n['energy-kcal_100g'];
  if(kcal==null&&n.energy_100g!=null&&String(n.energy_unit).toLowerCase()==='kj')kcal=Number(n.energy_100g)/4.184;
 }
 if(kcal==null||kcal===''||!Number.isFinite(Number(kcal))||Number(kcal)<0||Number(kcal)>1000)return null;
 return {barcode,unit,name:String(p.product_name||p.product_name_en||'Packaged food').slice(0,100),brand:String(p.brands||'').slice(0,100),kcal_per_100:Math.round(Number(kcal)*100)/100,serving:String(p.serving_size||'').slice(0,80),source_url:`https://world.openfoodfacts.org/product/${barcode}`,source:'Open Food Facts'};
}
export function barcodePortion(product,amount){
 const quantity=Number(amount),per100=Number(product?.kcal_per_100);
 if(!Number.isFinite(quantity)||quantity<=0||quantity>3000||!Number.isFinite(per100)||per100<0||per100>1000)throw Error('Check the portion and label calories.');
 const kcal=Math.round(per100*quantity/100);
 if(kcal<1||kcal>10000)throw Error('This portion must contain 1–10,000 kcal.');
 return kcal;
}
