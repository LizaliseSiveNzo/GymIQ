import { createClient } from 'npm:@supabase/supabase-js@2.45.0';
import { admin, authenticate, json } from '../_shared/launch.ts';
import { basicReview, canReview, deepseekRequest, validReview } from '../_shared/gymiq-review.ts';
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return json({});
  if (req.method !== 'POST') return json({ error: 'Method not allowed' },405);
  const user=await authenticate(req);
  if(!user)return json({error:'Sign in to review your records.'},401);
  try {
    const text=await req.text();
    if(text.length>2048)return json({error:'Review request is too large.'},400);
    let body;try{body=JSON.parse(text);}catch{return json({error:'Invalid review request.'},400);}
    if(!['training','nutrition'].includes(body.domain)||!/^\d{4}-\d{2}-\d{2}$/.test(body.day||'')||!Number.isInteger(body.offset)||Math.abs(body.offset)>840)return json({error:'Invalid review date or type.'},400);
    const scoped=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:req.headers.get('Authorization')!}},auth:{persistSession:false}});
    const result=await scoped.rpc('gymiq_review_snapshot',{p_domain:body.domain,p_day:body.day,p_offset:body.offset});
    if(result.error||!result.data)return json({error:'Could not load your review figures. Please try again.'},400);
    const snapshot=result.data;
    const fallback=basicReview(snapshot);
    const basic=(reason: string)=>json({source:'rules',review:fallback,snapshot,reason,created_at:new Date().toISOString(),cached:false});
    if(body.consent!==true)return basic('basic_selected');
    if(!canReview(snapshot))return basic('more_data_needed');
    const key=Deno.env.get('DEEPSEEK_API_KEY')?.trim();
    if(!key)return basic('not_configured');
    const membership=await scoped.rpc('has_active_membership');
    if(membership.error||membership.data!==true)return basic('membership_required');
    const model=Deno.env.get('DEEPSEEK_MODEL')?.trim()||'deepseek-flash';
    if(!['deepseek-flash','deepseek-v4-pro'].includes(model))return basic('not_configured');
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({version:2,model,snapshot})));
    const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
    const db=admin();
    const cached=await db.from('ai_review_cache').select('review,created_at,model').eq('user_id',user.id).eq('review_domain',body.domain).eq('snapshot_hash',hash).maybeSingle();
    if(cached.error)return basic('temporarily_unavailable');
    if(cached.data&&validReview(cached.data.review,body.domain))return json({source:'deepseek',review:cached.data.review,snapshot,model:cached.data.model,created_at:cached.data.created_at,cached:true});
    const reservation=await db.rpc('reserve_ai_review',{p_user:user.id,p_domain:body.domain,p_hash:hash});
    if(reservation.error||reservation.data?.status!=='reserved')return basic(reservation.data?.status||'temporarily_unavailable');
    try {
      const payload=deepseekRequest(snapshot,model);
      if(JSON.stringify(payload).length>6500)return basic('temporarily_unavailable');
      const response=await fetch('https://api.deepseek.com/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(45000)});
      if(!response.ok){console.warn('DeepSeek review unavailable',{stage:'provider',status:response.status});return basic(response.status===429?'provider_limit':'temporarily_unavailable');}
      const data=await response.json();
      const tokens=Number(data.usage?.total_tokens);
      if(Number.isInteger(tokens)&&tokens>=0)await db.from('ai_review_attempts').update({total_tokens:tokens}).eq('id',reservation.data.id).eq('user_id',user.id);
      if(data.choices?.[0]?.finish_reason!=='stop'){console.warn('DeepSeek review unavailable',{stage:'incomplete-output'});return basic('temporarily_unavailable');}
      const review=JSON.parse(data.choices[0].message.content);
      if(!validReview(review,body.domain)){console.warn('DeepSeek review unavailable',{stage:'output-validation'});return basic('temporarily_unavailable');}
      const saved=await db.from('ai_review_cache').upsert({user_id:user.id,review_domain:body.domain,snapshot_hash:hash,review,model,consented_at:new Date().toISOString(),created_at:new Date().toISOString()},{onConflict:'user_id,review_domain,snapshot_hash'}).select('created_at').single();
      return json({source:'deepseek',review,snapshot,model,cached:false,created_at:saved.data?.created_at||new Date().toISOString()});
    } catch { console.warn('DeepSeek review unavailable',{stage:'request-failed'});return basic('temporarily_unavailable'); }
  } catch { return json({error:'Your review could not be prepared. Please try again.'},500); }
});
