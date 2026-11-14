# OpenRouter coach speech (Fish Audio)

## Activation

1. Create an OpenRouter account and copy your API key from the dashboard.
2. Add `OPENROUTER_API_KEY` in Supabase Edge Function secrets.

The integration uses OpenRouter's TTS endpoint (`POST https://openrouter.ai/api/v1/audio/speech`) with the free `fish-audio/s2.1-pro-free:free` model and MP3 output. Read aloud calls `gymiq-speech` only when pressed.

## Voice

Default voice: `b347db033a6549378b48d00acb0d06cd`. To change it, edit `TTS_VOICE` in `supabase/functions/gymiq-speech/index.ts`.

## Caching & limits

- Private coach-speech bucket, short-lived 15-minute playback links, cached replays reuse stored audio.
- Per user: 30,000 new speech characters/day and 6 new generations/minute. App: 120/min and 1,000,000 chars/day by default. Configure `OPENROUTER_TTS_DAILY_CHARS`.

References: https://openrouter.ai/fish-audio/s2.1-pro-free
