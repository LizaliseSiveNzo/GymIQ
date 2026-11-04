import {admin,authenticate,json} from '../_shared/launch.ts';

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
  if(body.action!=='report'||typeof(body.search??'')!=='string'||(body.search||'').length>100||!Number.isInteger(body.page??0)||(body.page??0)<0||(body.page??0)>100000||!['all','paid','trial','expired','none'].includes(body.status||'all')||body.include_test!==undefined&&typeof body.include_test!=='boolean')return json({error:'Invalid report filters.'},400);
  const {data,error}=await db.rpc('owner_dashboard_report',{p_actor:user.id,p_search:body.search||'',p_page:body.page||0,p_status:body.status||'all',p_include_test:body.include_test===true});
  if(error)throw error;
  return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Cache-Control':'no-store'}});
 }catch{return json({error:'Could not load the report. Please try again.'},500);}
});
