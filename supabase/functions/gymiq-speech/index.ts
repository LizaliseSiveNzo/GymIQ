import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const admin = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
async function authenticate(req) {
  const token = req.headers.get('Authorization')?.replace(/^Bearer /i, '');
  if (!token) return null;
  const { data, error } = await admin().auth.getUser(token);
  return error ? null : data.user;
}

const TTS_MODEL = 'gemini-3.8-flash-tts';
const TTS_VOICE = 'Kore';

async function geminiSpeech({ text, key, signal }) {
  if (!key) throw Error('Gemini voice is not configured');
  if (typeof text !== 'string' || !text.trim()) throw Error('Reply unavailable for speech');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: text.trim() }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICE } } },
      },
    }),
    signal,
  });
  const j = await res.json();
  if (!res.ok || j?.error) throw Error('Gemini voice failed: ' + (j?.error?.message || `HTTP ${res.status}`));
  const part = j?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  const base64 = part?.inlineData?.data;
  if (!base64) throw Error('Gemini returned no audio');
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  if (!bytes.byteLength || bytes.byteLength > 8000000) throw Error('Invalid speech size');
  return { bytes, mimeType: part.inlineData.mimeType || 'audio/wav' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({});
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const user = await authenticate(req);
  if (!user) return json({ error: 'Sign in to read this reply.' }, 401);
  const db = admin(); let reserved = false, turnId = '';
  try {
    const raw = await req.text();
    if (raw.length > 250) return json({ error: 'Invalid speech request' }, 400);
    const body = JSON.parse(raw); turnId = body.turn_id;
    if (typeof turnId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(turnId)) return json({ error: 'Choose a saved reply.' }, 400);
    const scoped = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization')! } }, auth: { persistSession: false } });
    const [access, membership, turn] = await Promise.all([
      scoped.from('personal_coach_access').select('enabled').eq('user_id', user.id).maybeSingle(), scoped.rpc('has_active_membership'),
      scoped.from('coach_turns').select('reply,status').eq('id', turnId).eq('user_id', user.id).maybeSingle(),
    ]);
    if (access.error || !access.data?.enabled || membership.error || membership.data !== true) return json({ error: 'This feature is only for paid users.' });
    if (turn.error || !turn.data?.reply || turn.data.status !== 'done') return json({ error: 'Reply unavailable.' });
    const key = Deno.env.get('GEMINI_API_KEY')?.trim();
    if (!key) return json({ error: 'Gemini voice is not configured yet.', code: 'not_configured' }, 503);
    const cap = Number(Deno.env.get('GEMINI_TTS_DAILY_CHARS') || 1000000);
    const reservation = await db.rpc('reserve_coach_speech', { p_user: user.id, p_turn: turnId, p_voice: TTS_VOICE, p_daily_cap: Number.isInteger(cap) && cap > 0 ? cap : 1000000 });
    if (reservation.error) throw Error('Could not prepare speech: ' + (reservation.error.message || ''));
    const status = reservation.data?.status;
    if (status === 'busy' || status === 'limited') return json({ error: status === 'busy' ? 'This reply is already being prepared. Try again shortly.' : 'Gemini reading allowance reached. Try the device voice.' });
    const bucket = db.storage.from('coach-speech'), path = `${user.id}/${turnId}-${TTS_VOICE}.wav`;
    if (status === 'generate') {
      reserved = true;
      const { bytes, mimeType } = await geminiSpeech({ text: turn.data.reply, key, signal: AbortSignal.timeout(120000) });
      const upload = await bucket.upload(path, bytes, { contentType: 'audio/wav', upsert: true, cacheControl: '3600' }); if (upload.error) throw Error('Could not cache speech: ' + (upload.error.message || String(upload.error)));
      const saved = await db.from('coach_speech_jobs').update({ state: 'ready', updated_at: new Date().toISOString() }).eq('turn_id', turnId).eq('voice', TTS_VOICE).eq('user_id', user.id); if (saved.error) throw Error('Could not confirm speech');
      reserved = false;
    } else if (status !== 'cached') throw Error('Could not prepare speech');
    const signed = await bucket.createSignedUrl(path, 900); if (signed.error) throw Error('Could not open speech');
    const response = json({ url: signed.data.signedUrl, voice: TTS_VOICE, expires_in: 900, cached: status === 'cached' }); response.headers.set('Cache-Control', 'private, no-store'); return response;
  } catch (error) {
    console.error('gymiq-speech:', error instanceof Error ? error.message : String(error));
    if (reserved) await db.from('coach_speech_jobs').update({ state: 'failed', updated_at: new Date().toISOString() }).eq('turn_id', turnId).eq('voice', TTS_VOICE).eq('user_id', user.id);
    return json({ error: 'Gemini voice is unavailable. Try the device voice.', detail: error instanceof Error ? error.message : String(error) });
  }
});
