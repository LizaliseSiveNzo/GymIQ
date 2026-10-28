import { describe, expect, it } from 'vitest';
import { buildCheckoutPayload, normalizeAppOrigin } from '../../../../supabase/functions/_shared/yoco-checkout.ts';

describe('Yoco checkout return URLs', () => {
  it('adds HTTPS when the website setting is a bare domain', () => {
    const payload = buildCheckoutPayload('www.gym-iq.co.za', 'test-user');
    expect(payload.successUrl).toBe('https://www.gym-iq.co.za/more?payment=processing');
    expect(payload.cancelUrl).toBe('https://www.gym-iq.co.za/more?payment=cancelled');
    expect(payload.failureUrl).toBe('https://www.gym-iq.co.za/more?payment=failed');
    expect(payload.amount).toBe(10000);
    expect(payload.currency).toBe('ZAR');
  });
  it('normalizes whitespace and trailing slashes', () => {
    expect(normalizeAppOrigin(' https://www.gym-iq.co.za/ ')).toBe('https://www.gym-iq.co.za');
    expect(normalizeAppOrigin('www.gym-iq.co.za/')).toBe('https://www.gym-iq.co.za');
  });
  it('allows HTTP only for local development', () => {
    expect(normalizeAppOrigin('http://localhost:5174/')).toBe('http://localhost:5174');
    expect(() => normalizeAppOrigin('http://www.gym-iq.co.za')).toThrow('HTTPS');
  });
  it('rejects empty and invalid website settings', () => {
    for (const value of ['', ' ', 'not a domain', 'https://']) expect(() => normalizeAppOrigin(value)).toThrow();
  });
  it('rejects credentials or unsupported schemes in return addresses', () => {
    expect(() => normalizeAppOrigin('https://user:password@gym-iq.co.za')).toThrow('credentials');
    expect(() => normalizeAppOrigin('ftp://gym-iq.co.za')).toThrow('HTTPS');
  });
  it('rejects paths and query strings rather than generating broken callback URLs', () => {
    for (const value of ['https://gym-iq.co.za/login', 'https://gym-iq.co.za?x=1', 'https://gym-iq.co.za/#section']) {
      expect(() => normalizeAppOrigin(value)).toThrow('without a path');
    }
  });
});
