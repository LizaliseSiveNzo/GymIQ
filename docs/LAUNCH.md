# GymIQ launch handoff

The product now centres on Workouts, with Calorie Bank as its second core section. Academy, trainer/client, placeholder dashboard and Levels routes are no longer part of the public application. Existing deep links fall back to Workouts.

## Offer

R100 buys 30 days. Renewals are manual through Yoco; there is no recurring card debit. A one-time 7-day trial starts on first authenticated access. Confirmed early renewals add 30 days to remaining access. Expired users keep Account, export and read-only workout history. Database write policies enforce membership for core workout and bank tables.

## Backend already deployed

Project: GYMIQ / `brnshmmsyfitmotauaud`.

- Server-owned memberships and payment ledger, plus idempotent payment confirmation.
- Atomic programme creation and workout completion; stable open-session recovery.
- Full-history calorie aggregates and locked monthly deposit creation.
- Data export, account/storage deletion and support requests.
- Role updates locked down; five old anonymous academy endpoints retired.
- Edge Functions: `yoco-checkout`, `yoco-webhook`, `delete-account`, `support-notify`, `launch-health`.

The web frontend still needs deployment. Do not roll back to the old frontend: legacy entitlement writes have been revoked.

## Required Supabase Edge Function secrets

Set these through the project dashboard. Never put server secrets in Vite variables or commit them.

| Name | Value |
| --- | --- |
| `YOCO_SECRET_KEY` | Yoco secret API key for the desired mode |
| `YOCO_WEBHOOK_SECRET` | Signing secret returned by Yoco when registering the webhook |
| `GYMIQ_APP_URL` | Canonical deployed website origin, including HTTPS, without a trailing slash |
| `RESEND_API_KEY` | Sending API key from Resend |
| `GYMIQ_EMAIL_FROM` | GymIQ sender on a verified sending domain |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are supplied by Supabase. No Yoco public key is needed for hosted checkout.

Webhook: `https://brnshmmsyfitmotauaud.supabase.co/functions/v1/yoco-webhook`.

Run `scripts/register-yoco-webhook.ps1` in PowerShell to register it once. The helper prompts privately for the API key and displays the webhook signing secret locally. Save it immediately; Yoco returns it only once. Use matching test/live credentials. The webhook is intentionally public and authenticates the raw body using Yoco HMAC signatures with a three-minute replay window. All customer-facing functions authenticate the user.

Test-mode payments are recorded but deliberately do not extend production paid access. The live signed confirmation must match a server-created R100/ZAR checkout. A redirect back to the site is never proof of payment.

Support notification emails go to the operator-confirmed `Lizalisenzo@gmail.com`. Requests are saved even if email is not configured. No emails were sent during this development work. The connected Resend account currently has `clerly.co.za` verified; a GymIQ-branded domain has not been verified in this session. Configure a verified sender and Supabase Auth custom SMTP for confirmation/reset delivery; the Auth redirect allowlist must include the deployed `/login` URL and localhost during development.

## Verification performed

- Production build and unit suite, including six payment-signature tests.
- Phone-size landing/signup inspection with no horizontal overflow.
- `supabase/tests/launch_security.sql`: transaction-scoped fixtures, completely rolled back. Covers account isolation, forbidden role/membership updates, one-time trials, atomic programme rollback, retry idempotency, session reuse/completion, export isolation, more than 100 food entries, monthly deposit reuse, expired write denial, payment replay and account-deletion cascades.

## Release gates still requiring real accounts

1. Complete the missing secrets and Auth email/redirect settings.
2. Authorize the existing Vercel team connection, deploy this frontend, and confirm the canonical origin.
3. Run the deployed signup, email confirmation, password reset, onboarding, workout refresh/finish/history, food entry, export and disposable-account deletion flows.
4. Complete a Yoco checkout and verify exactly 30 days of extension from its signed webhook. Verify cancel/decline paths and duplicate-delivery handling. Refund requests are handled manually through support; refund webhooks do not currently adjust access automatically.
5. Review remaining Supabase advisories: legacy privileged helpers, `pg_net` in public, and leaked-password protection disabled. The limited retirement migration does not claim a full legacy database audit.

Do not advertise the deployment as accepting payment until the full live confirmation flow is verified. The visual refresh and database tests alone do not establish end-to-end production readiness.

## Sources

- [Yoco accepting a payment](https://developer.yoco.com/guides/online-payments/accepting-a-payment)
- [Yoco register webhook](https://developer.yoco.com/api-reference/checkout-api/webhooks/register-webhook)
- [Yoco verifying events](https://developer.yoco.com/guides/online-payments/webhooks/verifying-the-events)
