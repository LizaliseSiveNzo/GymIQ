# GymIQ free and premium launch

Free accounts can log freestyle workouts, use set/rest timers, view exercise records and history, and log food through the meal builder, diary and favourites. Manual weight check-ins remain free.

Premium unlocks prescribed programmes and new programme sessions, calorie goal planning, daily meal plans, barcode lookup, advanced reports, weekly check-ins and existing AI reviews. New accounts receive one seven-day premium trial. After expiry, free logging and saved records remain available. Existing unfinished sessions can still be resumed and finished.

Premium costs R100 for 30 days, manually renewed through the existing Yoco checkout. No automatic debit. Paid renewals extend the later of current membership/invited access. The separate personal AI chat pilot still requires its existing coach allowlist; a premium code never grants owner, administrator or personal coach permissions.

## Issue access codes

1. Sign into the owner account and open Account → Owner dashboard → Premium access codes.
2. Enter a label, premium duration (1–365 days), maximum recipients (1–100), redemption deadline (1–90 days), and optionally an account email restriction.
3. Create the code, then copy and share it privately. The full code is returned only once; the dashboard retains its last four characters and settings.
4. Recipients sign in and open Account → Have an access code? → Unlock premium. The same form appears at each paywall.
5. Revoke ends invited access associated with that code, without cancelling separately paid access. A redemption deadline only stops new redemptions; it does not shorten previously granted premium days.

Default codes grant 30 days, permit one recipient, and must be redeemed within 30 days. Redemption extends current access. Re-entering a previously redeemed code does not extend it again. Email restrictions use the authenticated, confirmed email supplied by the server, not an editable profile field.

## Security and operations

The server generates 96-bit random codes and stores SHA-256 hashes only. Code metadata, grants, management and redemption RPCs are inaccessible to customer/anonymous database roles. The two Edge Functions verify the signed-in user; only enabled owners can manage codes. Redemption is limited to ten attempts per account per hour. Row locks prevent exceeding usage caps and an account advisory lock serializes extensions, including Yoco confirmations. Failed code requests do not log the raw code. Codes are not payment records or revenue.

Core logging retains per-user RLS policies. Programme writes retain the premium restriction; a trigger also guards direct programme-session starts. Existing AI/planning Edge Functions enforce server membership. Advanced chart pages are presentation gates over a user's own records, not restrictions on exporting their data.

Deploy `premium-access` and `owner-dashboard` with JWT verification enabled. Apply the accompanying `premium_access_codes_and_free_tier` and `free_session_plan_and_set_undo` migrations before publishing the frontend. No new environment secrets are required.

Verification: `npm --prefix web test`, `npm --prefix web run build`, plus rollback-only SQL scripts in `scripts/verification/premium-access.sql`, `owner-app-access.sql` and `owner-dashboard.sql`. SQL fixtures cover free logging, saving session selections, undoing sets and finishing, programme enforcement, ownership, invite redemption, idempotency, usage/email limits, revocation, in-progress recovery, billing extension and rate limiting. Mobile interface previews use demonstration codes, never production credentials.
