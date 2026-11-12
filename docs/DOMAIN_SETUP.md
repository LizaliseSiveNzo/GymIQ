# GymIQ domain and sender setup

Website: https://www.gym-iq.co.za
Sender after Resend verification: GymIQ <notifications@gym-iq.co.za>

This document is the complete runbook to finish branded auth and transactional email.
The frontend code is already ready: signup confirmation and password reset are handled in
`web/src/pages/Login.jsx` and `web/src/context/AuthContext.jsx`; only the external
configuration below remains.

Resend domain created: 42a45219-5ef7-401b-ac76-a89364879396 (eu-west-1).
Current status: awaiting DNS verification.

## 1. Add DNS records (authoritative DNS provider for gym-iq.co.za)

TTL can be Auto/default. Preserve existing website records and existing email records.

| Type | Name | Value | Priority |
| --- | --- | --- | --- |
| TXT | resend._domainkey | p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDXwj3Ry2gC/zS82/+RFlgtzdTtOcpS+/OVRmmG6eosd4A4yowV+myZX2+NQtkfqjW60oqN+y5VpqSIgm3MdH0BIZ9DV0WP8JP4Dmx7tAkKwM1XyoOd6dM1glDbKsuaDULrbyFoRlfOhVtebfWxDWtIARYnyUd9FaD/bktz993Y8wIDAQAB | — |
| MX | send | feedback-smtp.eu-west-1.amazonses.com | 10 |
| TXT | send | v=spf1 include:amazonses.com ~all | — |
| CNAME | rsend | send.forge.rmta.net | — |

Public DNS inspection already found `www` pointing to `617e9f50c9a7afd3.vercel-dns-017.com`;
that is an observed record, not a new target to configure blindly. Project association and
certificate readiness still need verification through Vercel.

## 2. Verify the domain in Resend

After the DNS records propagate (can take minutes to a few hours), open the Resend dashboard
→ Domains → `gym-iq.co.za` → **Verify**. Status must become `Verified`.

## 3. Point Supabase Auth email at Resend (custom SMTP)

Supabase Dashboard → Project Settings → **Authentication** → **SMTP Settings** → *Enable
Custom SMTP*, then:

| Field | Value |
| --- | --- |
| Sender email | notifications@gym-iq.co.za |
| Sender name | GymIQ |
| Host | smtp.resend.com |
| Port | 465 (SSL) |
| Username | resend |
| Password | *(the Resend API key, `re_…` — the same value used for `RESEND_API_KEY`)* |

This makes signup-confirmation and password-reset emails send from the branded GymIQ domain
instead of Supabase's shared sender.

## 4. Set Auth site URL and login redirects

Supabase Dashboard → Project Settings → **Authentication** → **URL Configuration**:

- **Site URL:** `https://www.gym-iq.co.za`
- **Redirect URLs (allowlist):** add each on its own line:
  - `https://www.gym-iq.co.za/**`
  - `http://localhost:5173/**`
  - `http://localhost:5174/**`

The app already sends `redirectTo: window.location.origin + '/login?recovery=1'` for password
resets and consumes confirmation tokens via `detectSessionInUrl`, so no code change is needed.

## 5. Set Edge Function secrets

Supabase Dashboard → Project Settings → **Edge Functions** → *Secrets*:

| Name | Value |
| --- | --- |
| `GYMIQ_EMAIL_FROM` | `GymIQ <notifications@gym-iq.co.za>` |
| `GYMIQ_APP_URL` | `https://www.gym-iq.co.za` |
| `RESEND_API_KEY` | *(the Resend API key, `re_…`)* |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are supplied by Supabase automatically.
`YOCO_SECRET_KEY` and `YOCO_WEBHOOK_SECRET` are separate (payments, see `docs/LAUNCH.md`).

## 6. Verify end to end

1. Send a test email from Resend from `notifications@gym-iq.co.za` to a real inbox.
2. Sign up with a throwaway email → confirm the "Check your email" flow delivers and the
   confirmation link signs the user in at `https://www.gym-iq.co.za`.
3. Forgot-password → the reset link lands on `https://www.gym-iq.co.za/login?recovery=1` and
   lets the user set a new password.
4. Submit a support request → `support-notify` delivers to `Lizalisenzo@gmail.com` with the
   GymIQ sender.
