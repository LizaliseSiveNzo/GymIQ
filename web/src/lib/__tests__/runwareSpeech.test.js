/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { describe, it, expect } from 'vitest';
import { RUNWARE_VOICE, runwareSpeech } from '../../../../supabase/functions/_shared/runwareSpeech.js';

describe('runwareSpeech', () => {
  it('rejects missing key and empty text', async () => {
    const ok = async () => new Response('{}', { status: 200 });
    await expect(runwareSpeech({ text: 'Hello', key: '', fetchImpl: ok })).rejects.toThrow('not configured');
    await expect(runwareSpeech({ text: '', key: 'k', fetchImpl: ok })).rejects.toThrow('Reply unavailable for speech');
  });

  it('truncates long text to the HeyGen 5000-character limit', async () => {
    const calls = [];
    const fetchImpl = async (url, opts) => {
      calls.push({ url, opts });
      if (url === 'https://api.runware.ai/v1') {
        return new Response(JSON.stringify({ data: [{ audioURL: 'https://am.runware.ai/x.mp3' }] }), { status: 200 });
      }
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    };
    const bytes = await runwareSpeech({ text: 'a'.repeat(6000), key: 'fixture-key', fetchImpl });
    expect(calls[0].url).toBe('https://api.runware.ai/v1');
    expect(calls[0].opts.headers.Authorization).toBe('Bearer fixture-key');
    const sent = JSON.parse(calls[0].opts.body)[0];
    expect(sent.speech.text.length).toBe(5000);
    expect(sent.speech.voice).toBe(RUNWARE_VOICE);
    expect(bytes.byteLength).toBe(3);
  });
});
