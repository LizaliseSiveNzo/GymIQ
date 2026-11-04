const KEY='gymiq_referral_v1';
export const referralCode=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9_-]{0,63}$/.test(value.trim().toLowerCase())?value.trim().toLowerCase():null;
export function captureReferral(location=globalThis.location,storage,now=Date.now()){
 let source=null;
 try{
  const params=new URLSearchParams(location.search),candidate=referralCode(params.get('ref'));
  source=candidate;storage??=globalThis.localStorage;
  let prior=null;try{prior=JSON.parse(storage.getItem(KEY)||'null');}catch{/* A malformed prior value must not discard a valid new source. */}
  if(prior&&referralCode(prior.source)&&Number.isFinite(prior.at)&&now-prior.at>=0&&now-prior.at<30*86400000)return prior.source;
  if(source){storage.setItem(KEY,JSON.stringify({source,at:now}));return source;}
  storage.removeItem(KEY);
 }catch{/* Attribution must never block signup or navigation. */}
 return source;
}
export function signupReferral(){return captureReferral()||'direct';}
export function referralLink(source,origin=globalThis.location.origin){
 const code=referralCode(source);if(!code)throw Error('Use letters, numbers, hyphens or underscores, up to 64 characters.');
 const url=new URL('/',origin);url.searchParams.set('ref',code);return url.href;
}
