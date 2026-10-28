import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyYocoSignature } from '../../../../supabase/functions/_shared/yoco-signature.ts';
const raw = '{"type":"payment.succeeded","payload":{"amount":10000}}';
const now = Date.now();
const timestamp = String(Math.floor(now / 1000));
const key = Buffer.from('launch-test-signing-key');
const secret = `whsec_${key.toString('base64')}`;
function headers(body = raw, time = timestamp) {
  const signature = createHmac('sha256', key).update(`test-id.${time}.${body}`).digest('base64');
  return new Headers({ 'webhook-id': 'test-id', 'webhook-timestamp': time, 'webhook-signature': `v1,${signature}` });
}
describe('Yoco payment webhook verification', () => {
  it('accepts an authentic notification', async () => expect(await verifyYocoSignature(raw, headers(), secret, now)).toBe(true));
  it('rejects changes to amount or body', async () => expect(await verifyYocoSignature(raw.replace('10000','100'), headers(), secret, now)).toBe(false));
  it('rejects replayed notifications outside the time window', async () => expect(await verifyYocoSignature(raw, headers(raw,String(Number(timestamp)-181)), secret, now)).toBe(false));
  it('rejects future timestamps outside the time window', async () => expect(await verifyYocoSignature(raw, headers(raw,String(Number(timestamp)+181)), secret, now)).toBe(false));
  it('rejects missing or forged headers', async () => {
    expect(await verifyYocoSignature(raw, new Headers(), secret, now)).toBe(false);
    const forged = headers(); forged.set('webhook-signature','v1,Zm9yZ2Vk');
    expect(await verifyYocoSignature(raw, forged, secret, now)).toBe(false);
  });
  it('accepts any valid v1 signature during secret rotation', async () => {
    const candidates = headers(); candidates.set('webhook-signature',`v1,INVALID! ${candidates.get('webhook-signature')}`);
    expect(await verifyYocoSignature(raw, candidates, secret, now)).toBe(true);
  });
});
