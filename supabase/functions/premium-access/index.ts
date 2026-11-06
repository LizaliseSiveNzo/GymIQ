import {admin,authenticate,json} from '../_shared/launch.ts';
import {accessCodeHash} from '../_shared/accessCodes.ts';
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return json({});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const user=await authenticate(req);if(!user)return json({error:'Sign in to continue.'},401);
 try{
  const raw=await req.text();if(raw.length>500)return json({error:'Request too large.'},400);
  const body=JSON.parse(raw);
  if(typeof body.code!=='string'||body.code.length>100)return json({error:'Enter your access code.'},400);
  const {data,error}=await admin().rpc('redeem_premium_code',{p_user:user.id,p_email:user.email_confirmed_at?user.email:null,p_hash:await accessCodeHash(body.code)});
  if(error)throw error;
  return new Response(JSON.stringify(data),{status:data.ok?200:400,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Cache-Control':'no-store'}});
 }catch{return json({error:'Could not redeem the code. Please try again.'},503);}
});
