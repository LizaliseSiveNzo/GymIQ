export function hasPremium(member,now=Date.now()){
 return ['owner','paid','trial','invite'].includes(member?.kind)&&Date.parse(member.expires_at)>now;
}
export const PREMIUM_BANK_SECTIONS=['goals','plan','barcode','insights'];
