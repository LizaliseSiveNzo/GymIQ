// Pure verification, shared with the launch security tests.
export async function verifyYocoSignature(raw: string, headers: Headers, secret: string, now = Date.now()) {
  const id = headers.get('webhook-id');
  const timestamp = headers.get('webhook-timestamp');
  if (!id || !timestamp || !/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 180) return false;
  try {
    const bytes = Uint8Array.from(atob(secret.replace(/^whsec_/, '')), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    for (const signature of (headers.get('webhook-signature') || '').split(' ')) {
      const [version, encoded] = signature.split(',');
      if (version !== 'v1' || !encoded) continue;
      try {
        const supplied = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
        if (await crypto.subtle.verify('HMAC', key, supplied, new TextEncoder().encode(`${id}.${timestamp}.${raw}`))) return true;
      } catch { /* A malformed candidate must not hide another valid signature. */ }
    }
  } catch { return false; }
  return false;
}
