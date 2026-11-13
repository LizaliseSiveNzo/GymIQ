export const RUNWARE_MODEL = 'heygen:voice@1.0-turbo';
export const RUNWARE_VOICE = 'fca00394b42949c2a939acd456e3291f'; // Bram — calm and gentle

export async function runwareSpeech({ text, key, voice = RUNWARE_VOICE, fetchImpl = fetch, signal }) {
  if (!key) throw Error('Runware speech is not configured');
  if (typeof text !== 'string' || !text.trim()) throw Error('Reply unavailable for speech');
  const speechText = text.trim().slice(0, 5000); // HeyGen accepts up to 5000 characters
  const res = await fetchImpl('https://api.runware.ai/v1', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'User-Agent': 'GymIQ' },
    body: JSON.stringify([{
      taskType: 'audioInference',
      taskUUID: crypto.randomUUID(),
      model: RUNWARE_MODEL,
      speech: { text: speechText, voice },
      outputType: 'URL',
      outputFormat: 'MP3',
    }]),
    signal,
  });
  if (!res.ok) throw Error('Runware speech is temporarily unavailable');
  const body = await res.json();
  const audioURL = body?.data?.[0]?.audioURL;
  if (!audioURL) throw Error('Invalid speech response');
  const audioRes = await fetchImpl(audioURL, { signal });
  if (!audioRes.ok) throw Error('Runware speech is temporarily unavailable');
  const bytes = new Uint8Array(await audioRes.arrayBuffer());
  if (!bytes.byteLength || bytes.byteLength > 5000000) throw Error('Invalid speech size');
  return bytes;
}
