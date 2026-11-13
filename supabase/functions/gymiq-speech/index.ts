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

const RUNWARE_VOICE = 'fca00394b42949c2a939acd456e3291f'; // Bram — calm and gentle

async function runwareSpeech({ text, key, signal }) {
  if (!key) throw Error('Runware speech is not configured');
  if (typeof text !== 'string' || !text.trim()) throw Error('Reply unavailable for speech');
  const speechText = text.trim().slice(0, 5000); // HeyGen accepts up to 5000 characters
  const res = await fetch('https://api.runware.ai/v1', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'User-Agent': 'GymIQ' },
    body: JSON.stringify([{ taskType: 'audioInference', taskUUID: crypto.randomUUID(), model: 'heygen:voice@1.0', speech: { text: speechText, voice: RUNWARE_VOICE } }]),
    signal,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw Error(`Runware request failed (HTTP ${res.status}): ${detail.slice(0, 300)}`);
  }
  const body = await res.json();
  const audioURL = body?.data?.[0]?.audioURL;
  if (!audioURL) throw Error('Invalid speech response: ' + JSON.stringify(body).slice(0, 300));
  const audioRes = await fetch(audioURL, { signal });
  if (!audioRes.ok) throw Error(`Audio download failed (HTTP ${audioRes.status})`);
  const bytes = new Uint8Array(await audioRes.arrayBuffer());
  if (!bytes.byteLength || bytes.byteLength > 5000000) throw Error('Invalid speech size');
  return bytes;
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
    if (access.error || !access.data?.enabled || membership.error || membership.data !== true) return json({ error: 'Active coach access is required.' }, 403);
    if (turn.error || !turn.data?.reply || turn.data.status !== 'done') return json({ error: 'Reply unavailable.' }, 404);
    const key = Deno.env.get('RUNWARE_API_KEY')?.trim();
    if (!key) return json({ error: 'Runware voice is not configured yet.', code: 'not_configured' }, 503);
    const cap = Number(Deno.env.get('RUNWARE_TTS_DAILY_CHARS') || 1000000);
    const reservation = await db.rpc('reserve_coach_speech', { p_user: user.id, p_turn: turnId, p_voice: RUNWARE_VOICE, p_daily_cap: Number.isInteger(cap) && cap > 0 ? cap : 1000000 });
    if (reservation.error) throw Error('Could not prepare speech: ' + (reservation.error.message || ''));
    const status = reservation.data?.status;
    if (status === 'busy' || status === 'limited') return json({ error: status === 'busy' ? 'This reply is already being prepared. Try again shortly.' : 'Runware reading allowance reached. Try the device voice.', code: status }, 429);
    const bucket = db.storage.from('coach-speech'), path = `${user.id}/${turnId}-${RUNWARE_VOICE}.mp3`;
    if (status === 'generate') {
      reserved = true;
      const audio = await runwareSpeech({ text: turn.data.reply, key, signal: AbortSignal.timeout(30000) });
      const upload = await bucket.upload(path, audio, { contentType: 'audio/mpeg', upsert: true, cacheControl: '3600' }); if (upload.error) throw Error('Could not cache speech');
      const saved = await db.from('coach_speech_jobs').update({ state: 'ready', updated_at: new Date().toISOString() }).eq('turn_id', turnId).eq('voice', RUNWARE_VOICE).eq('user_id', user.id); if (saved.error) throw Error('Could not confirm speech');
      reserved = false;
    } else if (status !== 'cached') throw Error('Could not prepare speech');
    const signed = await bucket.createSignedUrl(path, 900); if (signed.error) throw Error('Could not open speech');
    const response = json({ url: signed.data.signedUrl, voice: RUNWARE_VOICE, expires_in: 900, cached: status === 'cached' }); response.headers.set('Cache-Control', 'private, no-store'); return response;
  } catch (error) {
    console.error('gymiq-speech:', error instanceof Error ? error.message : String(error));
    if (reserved) await db.from('coach_speech_jobs').update({ state: 'failed', updated_at: new Date().toISOString() }).eq('turn_id', turnId).eq('voice', RUNWARE_VOICE).eq('user_id', user.id);
    return json({ error: 'Runware reading is unavailable. Try the device voice.' }, 503);
  }
});
