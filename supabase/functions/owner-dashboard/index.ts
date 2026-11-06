import {admin,authenticate,json} from '../_shared/launch.ts';
import {newAccessCode,accessCodeHash} from '../_shared/accessCodes.ts';

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return json({});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const user=await authenticate(req);
 if(!user)return json({error:'Sign in to continue.'},401);
 const db=admin();
 const access=await db.from('owner_dashboard_access').select('enabled').eq('user_id',user.id).maybeSingle();
 if(access.error)return json({error:'Could not check owner access. Try again.'},503);
 if(!access.data?.enabled)return json({error:'Owner access required.'},403);
 try{
  const raw=await req.text();if(raw.length>1500)return json({error:'Request too large.'},400);
  const body=JSON.parse(raw||'{}');
  if(body.action==='status')return json({enabled:true});
  if(['codes','create_code','revoke_code'].includes(body.action)){
   const args:Record<string,unknown>={p_actor:user.id,p_action:body.action==='codes'?'list':body.action==='create_code'?'create':'revoke'};
   let code:string|undefined;
   if(body.action==='create_code'){
    if(typeof body.label!=='string'||body.label.trim().length<1||body.label.length>80||!Number.isInteger(body.days)||body.days<1||body.days>365||!Number.isInteger(body.max_uses)||body.max_uses<1||body.max_uses>100||!Number.isInteger(body.valid_days)||body.valid_days<1||body.valid_days>90||body.email!==undefined&&typeof body.email!=='string')return json({error:'Check your code settings.'},400);
    code=newAccessCode();Object.assign(args,{p_hash:await accessCodeHash(code),p_hint:code.slice(-4),p_label:body.label,p_days:body.days,p_uses:body.max_uses,p_valid_days:body.valid_days,p_email:body.email?.trim().toLowerCase()||null});
   }else if(body.action==='revoke_code'){
    if(typeof body.id!=='string'||!/^[a-f0-9-]{36}$/i.test(body.id))return json({error:'Choose an access code.'},400);
    args.p_id=body.id;
   }
   const {data,error}=await db.rpc('manage_premium_code',args);if(error)throw error;
   return new Response(JSON.stringify({...data,...(code?{code}:{})}),{headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Cache-Control':'no-store'}});
  }
  if(body.action!=='report'||typeof(body.search??'')!=='string'||(body.search||'').length>100||!Number.isInteger(body.page??0)||(body.page??0)<0||(body.page??0)>100000||!['all','paid','trial','invite','expired','none'].includes(body.status||'all')||body.include_test!==undefined&&typeof body.include_test!=='boolean')return json({error:'Invalid report filters.'},400);
  const {data,error}=await db.rpc('owner_dashboard_report',{p_actor:user.id,p_search:body.search||'',p_page:body.page||0,p_status:body.status||'all',p_include_test:body.include_test===true});
  if(error)throw error;
  return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Cache-Control':'no-store'}});
 }catch{return json({error:'Could not load the report. Please try again.'},500);}
});
