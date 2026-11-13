# Google Cloud coach speech

## Activation

1. Create a Google Cloud project and **enable the Cloud Text-to-Speech API**.
2. Create an **API key** restricted to the Text-to-Speech API.
3. Add `GOOGLE_TTS_API_KEY` in Supabase Edge Function secrets.

Never put the key in Vite/browser environment variables or paste it into chat.

The integration uses the official Google Cloud Text-to-Speech REST API with the `en-ZA-Standard-A` voice and MP3 output. No Google SDK loads at app startup. Read aloud calls `gymiq-speech` only when pressed. Google cloud speech is the default; selected device voices remain available under Ingredients & equipment → Reading voice. Selection is stored per account on the device.

## Access, caching and cost controls

- Valid JWT, authenticated user, active membership and enabled `personal_coach_access` are required.
- Client submits only a saved turn UUID. Server fetches the authenticated user's completed reply; arbitrary client text, voice names or URLs are not accepted. No user identity is included in the Google synthesis request.
- Private coach-speech bucket, service-only metadata and short-lived 15-minute playback links. Cached replays do not consume new generation allowance.
- Per user: 30,000 new speech characters/day and 6 new generations/minute. App: 120 new generations/minute and 1,000,000 new characters/day by default. Configure `GOOGLE_TTS_DAILY_CHARS` for the overall daily cap.
- Cloud requests time out; Stop aborts pending client work. Unavailable/offline cloud speech falls back to a clearly indicated device voice when supported.

## Voice note

Google Cloud's South African English voices are "Standard" quality (`en-ZA-Standard-A` through `D`). Higher-quality Neural2 voices exist for other English regions (en-US, en-GB, en-AU). To change voice, update `GOOGLE_VOICE` in `supabase/functions/_shared/googleSpeech.js` and the matching voice name in the `reserve_coach_speech` migration.

References: https://cloud.google.com/text-to-speech/docs
