/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { describe, it, expect } from 'vitest';
import { GOOGLE_VOICE, googleSpeech } from '../../../../supabase/functions/_shared/googleSpeech.js';

describe('googleSpeech', () => {
  it('rejects missing key, empty text and oversized replies', async () => {
    const ok = async () => new Response('{}', { status: 200 });
    await expect(googleSpeech({ text: 'Hello', key: '', fetchImpl: ok })).rejects.toThrow('not configured');
    await expect(googleSpeech({ text: '', key: 'k', fetchImpl: ok })).rejects.toThrow('Reply unavailable for speech');
    await expect(googleSpeech({ text: 'a'.repeat(8001), key: 'k', fetchImpl: ok })).rejects.toThrow('Reply unavailable for speech');
  });

  it('sends text to the Google endpoint and decodes MP3 audio', async () => {
    let called;
    const fetchImpl = async (url, opts) => {
      called = { url, opts };
      return new Response(JSON.stringify({ audioContent: 'aGVsbG8=' }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const bytes = await googleSpeech({ text: 'Hello', key: 'fixture-key', fetchImpl });
    expect(called.url).toContain('texttospeech.googleapis.com/v1/text:synthesize');
    expect(called.url).toContain('key=fixture-key');
    expect(called.opts.body).toContain(GOOGLE_VOICE);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.byteLength).toBe(5); // "hello"
  });

  it('throws on provider error and on missing audio content', async () => {
    await expect(googleSpeech({ text: 'Hello', key: 'k', fetchImpl: async () => new Response('private detail', { status: 429 }) })).rejects.toThrow('temporarily unavailable');
    await expect(googleSpeech({ text: 'Hello', key: 'k', fetchImpl: async () => new Response(JSON.stringify({}), { status: 200 }) })).rejects.toThrow('Invalid speech response');
  });
});
