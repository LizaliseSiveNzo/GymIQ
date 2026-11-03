# Simple personal coach chat

- One conversation, user message bubbles and assistant replies, compact bottom composer, Enter to send and Shift+Enter for a newline. Starter buttons fill the composer without sending a request.
- Ingredients/equipment remain in a collapsed settings panel. Unsaved changes still require Save before sending so requests use the selected availability.
- Read aloud shows Stop reading both on the active reply and in the fixed chat toolbar. Both cancel browser speech immediately. Reading resets on end/error, before dictation/new requests, on hiding the page and on unmount. Late completion from a cancelled utterance cannot clear the next utterance's state.
- Removed the coach message/voice consent checkboxes and explanatory blocks. Direct Send, Speak, Build with AI and Review with AI buttons initiate their respective features. Removed the matching checkboxes from meal planning and AI review cards too. API flags still identify an explicitly requested AI operation; no automatic AI requests were introduced.
- Proposal review and Apply/Save/Discard controls remain. Existing data access restrictions, server validation, manual plan application and provider configuration remain enforced.

Verification: 210 existing tests pass; production build succeeds. Isolated coach browser fixture confirmed shortcut filling, sending directly/with Enter, Shift+Enter newline, proposal Save meal result, reading state and both cancellation buttons using a simulated browser synthesizer. Mobile width 390px has no horizontal overflow; composer bottom 738px remains above navigation top 772px. Desktop width 1280px was visually checked. No real AI calls or microphone recordings were needed for these checks.

Screenshot: `artifacts/coach-chat-stop-reading-mobile.png` uses synthetic conversation and meal records.
