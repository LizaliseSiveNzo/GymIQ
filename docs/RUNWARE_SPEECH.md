# Runware coach speech (HeyGen voice)

## Activation

1. Create a Runware account and copy your API key from the dashboard.
2. Add `RUNWARE_API_KEY` in Supabase Edge Function secrets.

The integration uses Runware's REST endpoint (`POST https://api.runware.ai/v1`) with the `heygen:voice@1.0-turbo` model and MP3 output. Read aloud calls `gymiq-speech` only when pressed.

## Voice

Default voice: `fca00394b42949c2a939acd456e3291f` (Bram — calm and gentle). To change it, edit `RUNWARE_VOICE` in `supabase/functions/gymiq-speech/index.ts`. Runware's HeyGen voice list includes warm female options such as Cecily and Jocelyn if you prefer a different tone.

## Caching & limits

- Private coach-speech bucket, short-lived 15-minute playback links, cached replays reuse stored audio.
- Per user: 30,000 new speech characters/day and 6 new generations/minute. App: 120/min and 1,000,000 chars/day by default. Configure `RUNWARE_TTS_DAILY_CHARS`.
- Replies longer than 5000 characters are truncated to 5000 for speech (HeyGen's limit); the full reply still shows on screen.

References: https://runware.ai/docs/models/heygen-voice-1-0
