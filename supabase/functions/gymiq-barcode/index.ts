import {createClient} from 'npm:@supabase/supabase-js@2.45.0';
import {admin,authenticate,json} from '../_shared/launch.ts';
import {validBarcode,normalizeBarcodeProduct} from '../_shared/nutrition/barcode.js';
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return json({});if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const user=await authenticate(req);if(!user)return json({error:'Sign in to look up a barcode.'},401);
 try{
  const raw=await req.text();if(raw.length>1000)return json({error:'Request too large'},400);
  const {barcode}=JSON.parse(raw);if(!validBarcode(barcode))return json({error:'Enter a valid 8, 12, 13 or 14-digit food barcode.'},400);
  const scoped=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:req.headers.get('Authorization')!}},auth:{persistSession:false}});
  const membership=await scoped.rpc('has_active_membership');if(membership.error||membership.data!==true)return json({error:'Active membership is required.'},403);
  const db=admin(),cached=await db.from('barcode_product_cache').select('product,fetched_at').eq('barcode',barcode).maybeSingle();
  if(cached.data&&Date.parse(cached.data.fetched_at)>Date.now()-14*86400000)return json({product:cached.data.product,cached:true});
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
