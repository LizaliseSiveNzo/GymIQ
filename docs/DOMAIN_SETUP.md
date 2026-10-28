# GymIQ domain and sender setup

Website: https://www.gym-iq.co.za
Sender after Resend verification: GymIQ <notifications@gym-iq.co.za>

Resend domain created: 42a45219-5ef7-401b-ac76-a89364879396 (eu-west-1).
Current status: awaiting DNS verification.

Add the following records at the authoritative DNS provider. TTL can be Auto/default. Preserve existing website records and existing email records.

| Type | Name | Value | Priority |
| --- | --- | --- | --- |
| TXT | resend._domainkey | p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDXwj3Ry2gC/zS82/+RFlgtzdTtOcpS+/OVRmmG6eosd4A4yowV+myZX2+NQtkfqjW60oqN+y5VpqSIgm3MdH0BIZ9DV0WP8JP4Dmx7tAkKwM1XyoOd6dM1glDbKsuaDULrbyFoRlfOhVtebfWxDWtIARYnyUd9FaD/bktz993Y8wIDAQAB | — |
| MX | send | feedback-smtp.eu-west-1.amazonses.com | 10 |
| TXT | send | v=spf1 include:amazonses.com ~all | — |
| CNAME | rsend | send.forge.rmta.net | — |

After verification set GYMIQ_EMAIL_FROM to GymIQ <notifications@gym-iq.co.za> in Supabase Edge Function secrets.
After confirming the domain serves the correct frontend, set GYMIQ_APP_URL to https://www.gym-iq.co.za and update Supabase Auth Site URL and allowed login redirect URLs accordingly.

Public DNS inspection found www already pointing to 617e9f50c9a7afd3.vercel-dns-017.com; this is an observed record, not a new target to configure blindly. Project association and certificate readiness still need verification through Vercel.
