import { admin, json } from '../_shared/launch.ts';
import { verifyYocoSignature } from '../_shared/yoco-signature.ts';
// Public endpoint: verifies Yoco's HMAC over the exact raw body before accessing data.
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const secret = Deno.env.get('YOCO_WEBHOOK_SECRET');
  if (!secret) return json({ error: 'Webhook is not configured.' }, 503);
  const raw = await req.text();
  if (!(await verifyYocoSignature(raw, req.headers, secret))) return json({ error: 'Invalid signature.' }, 401);
  try {
    const event = JSON.parse(raw);
    if (event.type !== 'payment.succeeded') return json({ received: true });
    const payment = event.payload;
    if (payment.status !== 'succeeded' || payment.amount !== 10000 || payment.currency !== 'ZAR') return json({ error: 'Unexpected payment.' }, 400);
    const { error } = await admin().rpc('confirm_yoco_payment', {
      p_checkout: payment.metadata?.checkoutId, p_payment: payment.id, p_mode: payment.mode,
    });
    if (error) return json({ error: 'Payment confirmation is pending. Retry delivery.' }, 500);
    return json({ received: true });
  } catch { return json({ error: 'Invalid webhook.' }, 400); }
});
