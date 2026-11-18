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

function toBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

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
  if (req.method !== 'POST') return json({ error: 'Method not allowed' });
  const user = await authenticate(req);
  if (!user) return json({ error: 'Sign in to read this reply.' });
  try {
    const raw = await req.text();
    if (raw.length > 250) return json({ error: 'Invalid speech request' });
    const body = JSON.parse(raw);
    const turnId = body.turn_id;
    if (typeof turnId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(turnId)) return json({ error: 'Choose a saved reply.' });
    const scoped = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization')! } }, auth: { persistSession: false } });
    const [access, membership, turn] = await Promise.all([
      scoped.from('personal_coach_access').select('enabled').eq('user_id', user.id).maybeSingle(), scoped.rpc('has_active_membership'),
      scoped.from('coach_turns').select('reply,status').eq('id', turnId).eq('user_id', user.id).maybeSingle(),
    ]);
    if (access.error || !access.data?.enabled || membership.error || membership.data !== true) return json({ error: 'Active coach access is required.' });
    if (turn.error || !turn.data?.reply || turn.data.status !== 'done') return json({ error: 'Reply unavailable.' });
    const key = Deno.env.get('GEMINI_API_KEY')?.trim();
    if (!key) return json({ error: 'Gemini voice is not configured yet.' });
    const { bytes, mimeType } = await geminiSpeech({ text: turn.data.reply, key, signal: AbortSignal.timeout(120000) });
    return json({ audio: toBase64(bytes), mimeType });
  } catch (error) {
    console.error('gymiq-speech:', error instanceof Error ? error.message : String(error));
    return json({ error: 'Gemini voice is unavailable. Try the device voice.', detail: error instanceof Error ? error.message : String(error) });
  }
});
