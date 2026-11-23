import { createClient } from 'npm:@supabase/supabase-js@2.45.0';
import { admin, authenticate, json } from '../_shared/launch.ts';

const TTS_MODEL = 'gemini-3.8-flash-tts';
const TTS_VOICE = 'Kore';

function ascii(view, off, str) { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); }
function u16(b, o) { return b[o] | (b[o + 1] << 8); }
function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
function str4(b, o) { return String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]); }
function buildWav(data, sampleRate, channels, bits) {
  const header = new ArrayBuffer(44), view = new DataView(header);
  ascii(view, 0, 'RIFF'); view.setUint32(4, 36 + data.byteLength, true); ascii(view, 8, 'WAVE');
  ascii(view, 12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, channels, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * (bits / 8), true); view.setUint16(32, channels * (bits / 8), true); view.setUint16(34, bits, true);
  ascii(view, 36, 'data'); view.setUint32(40, data.byteLength, true);
  const out = new Uint8Array(44 + data.byteLength); out.set(new Uint8Array(header), 0); out.set(data, 44);
  return out;
}
function resamplePcm(bytes, fromRate, toRate) {
  if (fromRate === toRate || !bytes.byteLength) return bytes;
  const samples = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
  const ratio = fromRate / toRate;
  const outLen = Math.max(1, Math.round(samples.length / ratio));
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio, idx = Math.floor(pos), frac = pos - idx;
    const a = samples[idx], b = samples[Math.min(idx + 1, samples.length - 1)];
    out[i] = Math.round(a + (b - a) * frac);
  }
  return new Uint8Array(out.buffer, out.byteOffset, out.byteLength);
}
// Gemini appends a C2PA/JUMBF provenance chunk after the audio `data` chunk and
// emits 24 kHz PCM, which some browsers mark "unsupported". Rebuild a clean WAV
// from just the fmt + data chunks, resampled to 48 kHz (a universally supported
// rate). Raw PCM is wrapped in a header when needed.
function cleanAudio(bytes, mimeType) {
  const mime = (mimeType || 'audio/wav').toLowerCase();
  if (mime.includes('pcm') || mime.includes('l16')) {
    const rate = Number((mime.match(/rate=(\d+)/) || [])[1]) || 24000;
    return buildWav(resamplePcm(bytes, rate, 48000), 48000, 1, 16);
  }
  if (bytes.byteLength >= 12 && str4(bytes, 0) === 'RIFF' && str4(bytes, 8) === 'WAVE') {
    let offset = 12, sampleRate = 24000, channels = 1, bits = 16, data = null;
    while (offset + 8 <= bytes.byteLength) {
      const id = str4(bytes, offset), size = u32(bytes, offset + 4);
      if (id === 'fmt ' && size >= 16 && u16(bytes, offset + 8) === 1) {
        channels = u16(bytes, offset + 10); sampleRate = u32(bytes, offset + 12); bits = u16(bytes, offset + 22);
      } else if (id === 'data') {
        data = bytes.slice(offset + 8, offset + 8 + size);
        break;
      }
      offset += 8 + size + (size & 1);
    }
    if (data) {
      if (bits === 16) data = resamplePcm(data, sampleRate, 48000);
      return buildWav(data, bits === 16 ? 48000 : sampleRate, channels, bits);
    }
  }
  return bytes;
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
  let bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  if (!bytes.byteLength || bytes.byteLength > 8000000) throw Error('Invalid speech size');
  bytes = cleanAudio(bytes, part.inlineData.mimeType);
  return { bytes };
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
      const { bytes } = await geminiSpeech({ text: turn.data.reply, key, signal: AbortSignal.timeout(120000) });
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
