import {createClient} from 'npm:@supabase/supabase-js@2.45.0';
import {admin,authenticate,json} from '../_shared/launch.ts';
import {validBarcode,normalizeBarcodeProduct} from '../_shared/nutrition/barcode.js';

const num=(v:any)=>{const n=Number(v);return Number.isFinite(n)&&n>=0?Math.round(n*10)/10:null;};

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return json({});if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const user=await authenticate(req);if(!user)return json({error:'Sign in to look up a barcode.'},401);
 try{
  const raw=await req.text();if(raw.length>1200)return json({error:'Request too large'},400);
  const body=JSON.parse(raw);
  const db=admin();

  // Teach a barcode the user looked up manually (learn once, scan forever).
  if(body.action==='save'){
   const barcode=String(body.barcode||'');
   const name=String(body.name||'').trim().slice(0,100);
   const kcal=num(body.kcal_per_100);
   if(!validBarcode(barcode))return json({error:'Enter a valid barcode.'},400);
   if(!name)return json({error:'Enter the product name.'},400);
   if(kcal==null||kcal<0||kcal>1000)return json({error:'Enter the calories per 100 g/ml.'},400);
   const {error}=await db.from('user_product_barcodes').upsert({
    barcode,user_id:user.id,name,kcal_per_100:kcal,
    protein_per_100:num(body.protein_per_100),carbs_per_100:num(body.carbs_per_100),fat_per_100:num(body.fat_per_100),
    unit:body.unit==='ml'?'ml':'g',brand:String(body.brand||'').slice(0,100)||null,
   },{onConflict:'barcode,user_id'});
   if(error)throw error;
   return json({saved:true});
  }

  const barcode=body.barcode;
  if(!validBarcode(barcode))return json({error:'Enter a valid 8, 12, 13 or 14-digit food barcode.'},400);

  // 1. User-taught products first.
  const local=await db.from('user_product_barcodes').select('*').eq('barcode',barcode).eq('user_id',user.id).maybeSingle();
  if(local.data){
   return json({product:{barcode,unit:local.data.unit||'g',name:local.data.name,brand:local.data.brand||'',kcal_per_100:Number(local.data.kcal_per_100),protein_per_100:local.data.protein_per_100!=null?Number(local.data.protein_per_100):null,carbs_per_100:local.data.carbs_per_100!=null?Number(local.data.carbs_per_100):null,fat_per_100:local.data.fat_per_100!=null?Number(local.data.fat_per_100):null,serving:'',source_url:'',source:'Your saved items'},cached:true});
  }

  // 2. Open Food Facts cache.
  const cached=await db.from('barcode_product_cache').select('product,fetched_at').eq('barcode',barcode).maybeSingle();
  if(cached.data&&Date.parse(cached.data.fetched_at)>Date.now()-14*86400000)return json({product:cached.data.product,cached:true});

  // 3. Open Food Facts.
  const reserve=await db.rpc('reserve_barcode_lookup',{p_user:user.id});if(reserve.error||reserve.data!==true)return json({error:'Barcode lookup is busy. Try again in a minute, or enter the label calories.'},429);
  const response=await fetch(`https://world.openfoodfacts.org/api/v3.6/product/${barcode}.json?fields=product_name,product_name_en,brands,nutrition,nutriments,serving_size`,{headers:{'User-Agent':'GymIQ/1.0 (https://www.gym-iq.co.za)'},signal:AbortSignal.timeout(10000),redirect:'error'});
  if(response.status===404)return json({error:'Product not found. Enter calories from the package label instead.'},404);
  if(!response.ok)return json({error:'The food database is unavailable. Enter the label calories or try later.'},503);
  const product=normalizeBarcodeProduct(await response.json(),barcode);
  if(!product)return json({error:'This product has no usable calorie values. Use the package label instead.'},404);
  await db.from('barcode_product_cache').upsert({barcode,product,fetched_at:new Date().toISOString()});
  return json({product});
 }catch{return json({error:'Barcode lookup could not finish. Use the package label or try again.'},503);}
});
