/** Settings may be pasted as a bare domain; Yoco requires absolute return URLs. */
export function normalizeAppOrigin(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('Website address is missing.');
  const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  if (url.username || url.password) throw new Error('Website address must not contain credentials.');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new Error('Website address must use HTTPS.');
  }
  if (url.pathname !== '/' || url.search || url.hash) throw new Error('Website address must be an origin without a path.');
  return url.origin;
}

export function buildCheckoutPayload(appOrigin: string, userId: string) {
  const origin = normalizeAppOrigin(appOrigin);
  return {
    amount: 10000, currency: 'ZAR', clientReferenceId: userId,
    successUrl: `${origin}/more?payment=processing`,
    cancelUrl: `${origin}/more?payment=cancelled`,
    failureUrl: `${origin}/more?payment=failed`,
    metadata: { userId, product: 'gymiq_30_days' },
  };
}
