/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { describe, it, expect } from 'vitest';
import { googleSpeech } from '../../../../supabase/functions/_shared/googleSpeech.js';

describe('googleSpeech', () => {
  it('rejects missing credentials, empty text and oversized replies', async () => {
    const ok = async () => new Response('{}', { status: 200 });
    await expect(googleSpeech({ text: 'Hello', clientEmail: '', privateKey: '', fetchImpl: ok })).rejects.toThrow('not configured');
    await expect(googleSpeech({ text: 'Hello', clientEmail: 'e', privateKey: '', fetchImpl: ok })).rejects.toThrow('not configured');
    await expect(googleSpeech({ text: '', clientEmail: 'e', privateKey: 'k', fetchImpl: ok })).rejects.toThrow('Reply unavailable for speech');
    await expect(googleSpeech({ text: 'a'.repeat(8001), clientEmail: 'e', privateKey: 'k', fetchImpl: ok })).rejects.toThrow('Reply unavailable for speech');
  });
});
