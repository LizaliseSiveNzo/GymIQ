import {describe,expect,it} from 'vitest';
import {captureReferral,referralCode,referralLink} from '../referrals.js';
const fixture=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
describe('signup referral attribution',()=>{
 it('keeps the first source across navigation and signup for thirty days',()=>{
  const storage=fixture(),now=100000;
  expect(captureReferral({search:'?ref=Gym-A'},storage,now)).toBe('gym-a');
  expect(captureReferral({search:'?ref=trainer-b'},storage,now+100)).toBe('gym-a');
  expect(captureReferral({search:''},storage,now+1000)).toBe('gym-a');
  expect(captureReferral({search:'?ref=trainer-b'},storage,now+31*86400000)).toBe('trainer-b');
 });
 it('rejects arbitrary URLs, control characters, private query strings and oversized values',()=>{
  for(const value of ['https://evil.example','a&email=person@example.com','a\nb','x'.repeat(65),''])expect(referralCode(value)).toBeNull();
  expect(referralCode(' Trainer_1 ')).toBe('trainer_1');
  expect(referralLink('Gym-A','https://www.gym-iq.co.za')).toBe('https://www.gym-iq.co.za/?ref=gym-a');
 });
 it('does not block navigation if storage is disabled or malformed',()=>{
  expect(captureReferral({search:'?ref=gym-a'},{getItem:()=>{throw Error();}},1000)).toBe('gym-a');
  const storage=fixture();storage.setItem('gymiq_referral_v1','bad-json');
  expect(captureReferral({search:'?ref=gym-a'},storage,1000)).toBe('gym-a');
 });
});
