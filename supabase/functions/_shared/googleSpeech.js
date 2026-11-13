export const GOOGLE_VOICE = 'en-ZA-Standard-A';
export async function googleSpeech({ text, key, fetchImpl = fetch, signal }) {
  if (!key) throw Error('Google speech is not configured');
  if (typeof text !== 'string' || !text.trim() || text.length > 8000) throw Error('Reply unavailable for speech');
  const response = await fetchImpl(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'GymIQ' },
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
