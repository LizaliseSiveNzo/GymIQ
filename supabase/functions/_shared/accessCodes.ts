export function newAccessCode(){
 const bytes=crypto.getRandomValues(new Uint8Array(12));
 const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
 return 'GYMIQ-'+hex.match(/.{6}/g)!.join('-');
}
export async function accessCodeHash(value:string){
 const canonical=value.trim().toUpperCase().replace(/[\s-]/g,'');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical));
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
