// User consent to send data to third-party AI providers (DeepSeek coach, Gemini
// photo analysis / read-aloud). On by default; users can opt out.
const KEY = 'gymiq_ai_consent';
export function getAiConsent() {
  try { return localStorage.getItem(KEY) !== '0'; } catch { return true; }
}
export function setAiConsent(allow) {
  try { localStorage.setItem(KEY, allow ? '1' : '0'); } catch { /* optional */ }
}
