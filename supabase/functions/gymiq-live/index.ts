// gymiq-live: mints a short-lived Gemini Live ephemeral token for a premium user.
// The GEMINI_API_KEY stays here; the browser only ever sees an ephemeral token.
import { createClient } from 'npm:@supabase/supabase-js@2.45.0';
import { authenticate, json } from '../_shared/launch.ts';

const GEMINI_TOKEN_URL = 'https://generativelanguage.googleapis.com/v1beta/auth_tokens';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({});
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const user = await authenticate(req);
  if (!user) return json({ error: 'Sign in to use the voice coach.' }, 401);
  const scoped = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization')! } }, auth: { persistSession: false } },
  );
  const membership = await scoped.rpc('has_active_membership');
  if (membership.error || membership.data !== true) return json({ error: 'The voice coach is a premium feature.', code: 'premium_required' }, 403);
  const key = Deno.env.get('GEMINI_API_KEY')?.trim();
  if (!key) return json({ error: 'Voice coach is not configured yet.', code: 'not_configured' }, 503);
  try {
    const now = Date.now();
    const body = {
      uses: 1,
      expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
      newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
    };
    const res = await fetch(GEMINI_TOKEN_URL, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = typeof data?.error?.message === 'string' ? data.error.message.slice(0, 200) : '';
      return json({ error: `Could not start the voice coach (${res.status}). ${detail || 'Please try again.'}` }, 502);
    }
    if (typeof data.name !== 'string' || !data.name) return json({ error: 'Could not start the voice coach. Please try again.' }, 502);
    return json({ token: data.name, model: 'gemini-3.8-live' });
  } catch { return json({ error: 'Could not start the voice coach. Please try again.' }, 500); }
});
