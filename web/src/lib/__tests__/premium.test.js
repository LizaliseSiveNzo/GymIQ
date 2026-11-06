import {describe,it,expect} from 'vitest';
import {hasPremium,PREMIUM_BANK_SECTIONS} from '../premium.js';
import {newAccessCode,accessCodeHash} from '../../../../supabase/functions/_shared/accessCodes.ts';
describe('premium access',()=>{
 for(const kind of ['owner','paid','trial','invite'])it(`recognises active ${kind} access`,()=>{expect(hasPremium({kind,expires_at:'2099-01-01'})).toBe(true);expect(hasPremium({kind,expires_at:'2000-01-01'})).toBe(false);});
 it('rejects missing, unknown and free entitlements',()=>{for(const value of [null,{}, {kind:'free',expires_at:'2099-01-01'},{kind:'admin',expires_at:'2099-01-01'},{kind:'paid',expires_at:'invalid'}])expect(hasPremium(value)).toBe(false);});
 it('keeps manual logging outside premium sections',()=>{for(const section of ['home','builder','quick','diary','weight'])expect(PREMIUM_BANK_SECTIONS).not.toContain(section);});
 it('creates strong, independently random access codes',()=>{const codes=Array.from({length:100},()=>newAccessCode());expect(new Set(codes).size).toBe(100);for(const code of codes)expect(code).toMatch(/^GYMIQ-(?:[A-F0-9]{6}-){3}[A-F0-9]{6}$/);});
 it('normalises copied codes but distinguishes different secrets',async()=>{const code=newAccessCode();expect(await accessCodeHash(code)).toMatch(/^[a-f0-9]{64}$/);expect(await accessCodeHash(code.toLowerCase().replaceAll('-',' '))).toBe(await accessCodeHash(code));expect(await accessCodeHash(newAccessCode())).not.toBe(await accessCodeHash(code));});
});
