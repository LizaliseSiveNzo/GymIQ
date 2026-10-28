import { admin, authenticate, json } from '../_shared/launch.ts';
import { buildCheckoutPayload } from '../_shared/yoco-checkout.ts';
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return json({});
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const user = await authenticate(req);
  if (!user) return json({ error: 'Sign in again to continue.' }, 401);
  const key = Deno.env.get('YOCO_SECRET_KEY')?.trim();
  const appUrl = Deno.env.get('GYMIQ_APP_URL');
  if (!key || !appUrl) return json({ error: 'Payments are not available yet. Please contact support in Account.' }, 503);
  try {
    const body = await req.json();
    if (!/^[0-9a-f-]{36}$/i.test(body.requestId || '')) return json({ error: 'Invalid checkout request.' }, 400);
    let payload;
    try { payload = buildCheckoutPayload(appUrl, user.id); }
    catch { return json({ error: 'The website payment return address needs attention. Please contact support.' }, 503); }
    const response = await fetch('https://payments.yoco.com/api/checkouts', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `${user.id}-${body.requestId}` },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      const rejection = await response.json().catch(() => ({}));
      const scrub = (value: unknown) => typeof value === 'string' ? value.split(key).join('[redacted]').slice(0, 350) : undefined;
      const reason = scrub(rejection.reason) || scrub(rejection.errorCode) || scrub(rejection.code);
      console.error('Yoco checkout rejected', { status: response.status, reason, message: scrub(rejection.message) || scrub(rejection.description) });
      return json({ error: 'Yoco could not open checkout. Please try again.', providerStatus: response.status,
        providerReason: reason,
      }, 502);
    }
    const checkout = await response.json();
    const { error } = await admin().from('membership_payments').upsert({ checkout_id: checkout.id,
      user_id: user.id, amount: 10000, currency: 'ZAR', mode: checkout.processingMode,
    }, { onConflict: 'checkout_id', ignoreDuplicates: true });
    if (error) throw error;
    return json({ redirectUrl: checkout.redirectUrl });
  } catch { return json({ error: 'Checkout could not start. Please try again.' }, 500); }
});
