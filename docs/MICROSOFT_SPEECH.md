# Microsoft coach speech

## Activation

Create an Azure Speech resource, then add AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in Supabase Edge Function secrets. Use the resource region ID (for example eastus), not a URL. Never put a secret key in Vite/browser environment variables. No key values should be pasted into chat. S0 is the production tier to evaluate for a large rollout; review Azure pricing and service quotas for your actual demand. F0 is useful for evaluation but has fixed low quotas.

The integration uses the official Azure Speech REST API with en-ZA-LeahNeural, 24kHz/48kbps mono MP3. It is not an unofficial Edge Read Aloud consumer endpoint. No Azure SDK loads at app startup. Read aloud calls gymiq-speech only when pressed. Microsoft cloud speech is default; selected device voices remain available under Ingredients & equipment → Reading voice, including Microsoft browser voices where actually exposed. Selection is stored per account on the device.

## Access, caching and cost controls

- Valid JWT, authenticated user, active membership and enabled personal_coach_access are required. Existing owner-only coach rollout remains in effect; this change does not enable every customer.
- Client submits only a saved turn UUID. Server fetches the authenticated user's completed reply; arbitrary client text, voice names or URLs are not accepted. No user identity is included in the Microsoft synthesis request. Reply text itself may contain personal details, as explained in Privacy.
- Private coach-speech bucket, service-only metadata and short-lived 15-minute playback links. No public storage policies. Existing account-deletion cleanup includes service-owned cached audio paths.
- Unique reservation prevents duplicate concurrent synthesis. Cached replays do not consume new generation allowance. Failed attempts count against allowance to bound abuse.
- Per user: 30,000 new speech characters/day and 6 new generations/minute. App: 120 new generations/minute and 1,000,000 new characters/day by default. Configure AZURE_SPEECH_DAILY_CHARS for the overall daily cap (SQL clamps 1–10,000,000). These are generation limits; cached playback is separate. Review Azure budget alerts and adjust caps before increasing access. Character limits bound approximate usage, not a currency-denominated Azure billing cap.
- Cloud requests time out; Stop aborts pending client work and pauses playing audio. Late responses cannot restart audio. Already-started server generation may finish and be cached. Browser autoplay restrictions show a prompt to tap Read aloud again. Unavailable/unconfigured/offline cloud speech falls back to a clearly indicated device voice when supported.
- Signed audio URLs are held in memory only and cleared when the account changes. Audio remains cached in private server storage until account deletion; monitor storage/egress growth and define a retention policy as rollout grows.

## Verification

222 tests cover SSML escaping, bounded inputs, endpoint/credential placement, non-audio/error responses, Microsoft browser voice preference, signed-URL replay caching, stop-during-download, competing reply races and autoplay rejection. Production build passes. SQL transaction fixture tests reservation, duplicate prevention, cache reuse, limits, owner access, private bucket and client privilege denial; all fixture writes roll back. Browser fixture verified cloud MP3 playback state, Stop reading and switching to a device voice using simulated audio; it does not demonstrate actual Microsoft sound quality. Live synthesis needs the Azure secrets before it can be tested.

References: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech and https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-services-quotas-and-limits
