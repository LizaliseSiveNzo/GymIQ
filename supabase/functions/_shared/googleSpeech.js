export const GOOGLE_VOICE = 'en-ZA-Standard-A';

function base64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToArrayBuffer(pem) {
  const b64 = String(pem)
    .replace(/\\n/g, '')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function googleAccessToken({ clientEmail, privateKey, fetchImpl }) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = base64url(new TextEncoder().encode(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })));
  const signingInput = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput)));
  const assertion = `${signingInput}.${base64url(sig)}`;
  const res = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant_type%3Ajwt-bearer&assertion=${encodeURIComponent(assertion)}`,
  });
  if (!res.ok) throw Error('Google speech is temporarily unavailable');
  const data = await res.json();
  if (!data?.access_token) throw Error('Google speech is temporarily unavailable');
  return data.access_token;
}

export async function googleSpeech({ text, clientEmail, privateKey, fetchImpl = fetch, signal }) {
  if (!clientEmail || !privateKey) throw Error('Google speech is not configured');
  if (typeof text !== 'string' || !text.trim() || text.length > 8000) throw Error('Reply unavailable for speech');
  const token = await googleAccessToken({ clientEmail, privateKey, fetchImpl });
  const response = await fetchImpl('https://texttospeech.googleapis.com/v1/text:synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'User-Agent': 'GymIQ' },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: 'en-ZA', name: GOOGLE_VOICE, ssmlGender: 'FEMALE' },
      audioConfig: { audioEncoding: 'MP3' },
    }),
    signal,
  });
  if (!response.ok) throw Error('Google speech is temporarily unavailable');
  const data = await response.json();
  if (!data?.audioContent) throw Error('Invalid speech response');
  const bytes = Uint8Array.from(atob(data.audioContent), (c) => c.charCodeAt(0));
  if (!bytes.byteLength || bytes.byteLength > 5000000) throw Error('Invalid speech size');
  return bytes;
}
