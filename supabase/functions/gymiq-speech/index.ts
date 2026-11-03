import {createClient} from 'npm:@supabase/supabase-js@2.45.0';
import {admin,authenticate,json} from '../_shared/launch.ts';
import {MICROSOFT_VOICE,microsoftSpeech} from '../_shared/microsoftSpeech.js';
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return json({});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const user=await authenticate(req);if(!user)return json({error:'Sign in to read this reply.'},401);
 const db=admin();let reserved=false,turnId='';
 try{
  const raw=await req.text();if(raw.length>250)return json({error:'Invalid speech request'},400);
  const body=JSON.parse(raw);turnId=body.turn_id;
  if(typeof turnId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(turnId))return json({error:'Choose a saved reply.'},400);
  const scoped=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:req.headers.get('Authorization')!}},auth:{persistSession:false}});
  const [access,membership,turn]=await Promise.all([
   scoped.from('personal_coach_access').select('enabled').eq('user_id',user.id).maybeSingle(),scoped.rpc('has_active_membership'),
   scoped.from('coach_turns').select('reply,status').eq('id',turnId).eq('user_id',user.id).maybeSingle(),
  ]);
  if(access.error||!access.data?.enabled||membership.error||membership.data!==true)return json({error:'Active coach access is required.'},403);
  if(turn.error||!turn.data?.reply||turn.data.status!=='done')return json({error:'Reply unavailable.'},404);
  const key=Deno.env.get('AZURE_SPEECH_KEY')?.trim(),region=Deno.env.get('AZURE_SPEECH_REGION')?.trim();
  if(!key||!region)return json({error:'Microsoft voice is not configured yet.',code:'not_configured'},503);
  const cap=Number(Deno.env.get('AZURE_SPEECH_DAILY_CHARS')||1000000);
  const reservation=await db.rpc('reserve_coach_speech',{p_user:user.id,p_turn:turnId,p_voice:MICROSOFT_VOICE,p_daily_cap:Number.isInteger(cap)&&cap>0?cap:1000000});
  if(reservation.error)throw Error('Could not prepare speech');
  const status=reservation.data?.status;
  if(status==='busy'||status==='limited')return json({error:status==='busy'?'This reply is already being prepared. Try again shortly.':'Microsoft reading allowance reached. Try the device voice.',code:status},429);
  const bucket=db.storage.from('coach-speech'),path=`${user.id}/${turnId}-${MICROSOFT_VOICE}.mp3`;
  if(status==='generate'){
   reserved=true;
   const audio=await microsoftSpeech({text:turn.data.reply,key,region,signal:AbortSignal.timeout(25000)});
   const upload=await bucket.upload(path,audio,{contentType:'audio/mpeg',upsert:true,cacheControl:'3600'});if(upload.error)throw Error('Could not cache speech');
   const saved=await db.from('coach_speech_jobs').update({state:'ready',updated_at:new Date().toISOString()}).eq('turn_id',turnId).eq('voice',MICROSOFT_VOICE).eq('user_id',user.id);if(saved.error)throw Error('Could not confirm speech');
   reserved=false;
  }else if(status!=='cached')throw Error('Could not prepare speech');
  const signed=await bucket.createSignedUrl(path,900);if(signed.error)throw Error('Could not open speech');
  const response=json({url:signed.data.signedUrl,voice:MICROSOFT_VOICE,expires_in:900,cached:status==='cached'});response.headers.set('Cache-Control','private, no-store');return response;
 }catch{
  if(reserved)await db.from('coach_speech_jobs').update({state:'failed',updated_at:new Date().toISOString()}).eq('turn_id',turnId).eq('voice',MICROSOFT_VOICE).eq('user_id',user.id);
  return json({error:'Microsoft reading is unavailable. Try the device voice.'},503);
 }
});
