# OpenRouter coach speech (HeyGen voice)

## Activation

1. Create an OpenRouter account and copy your API key from the dashboard.
2. Add `OPENROUTER_API_KEY` in Supabase Edge Function secrets.

The integration uses OpenRouter's TTS endpoint (`POST https://openrouter.ai/api/v1/audio/speech`) with the free `heygen/heygen-voice-1-turbo:free` model and MP3 output. Read aloud calls `gymiq-speech` only when pressed.

## Voice

Default voice: `nadine`. To change it, edit `TTS_VOICE` in `supabase/functions/gymiq-speech/index.ts` (e.g. `bram`, `cecily`, `jocelyn`).

## Caching & limits

- Private coach-speech bucket, short-lived 15-minute playback links, cached replays reuse stored audio.
- Per user: 30,000 new speech characters/day and 6 new generations/minute. App: 120/min and 1,000,000 chars/day by default. Configure `OPENROUTER_TTS_DAILY_CHARS`.

References: https://openrouter.ai/heygen/heygen-voice-1-turbo
