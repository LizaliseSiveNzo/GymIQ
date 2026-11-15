-- Public FAQ response cache: vetted public product info only.
-- Read/write restricted to service_role so only edge functions may use it.
-- Nothing private (prompts, user IDs, profiles, histories) may ever be stored here.
create table if not exists public.faq_cache (
  id uuid primary key default gen_random_uuid(),
  query_key text not null,
  topic text not null check (topic in ('navigation','product','account','billing')),
  answer text not null check (length(answer) between 1 and 1200),
  content_version text not null default '2026-11-16-v1',
  language text not null default 'en',
  prompt_version text not null default 'faq-v1',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists faq_cache_lookup on public.faq_cache(query_key, content_version, language, prompt_version, expires_at);
alter table public.faq_cache enable row level security;
revoke all on public.faq_cache from public, anon, authenticated;
grant all on public.faq_cache to service_role;

-- Seed: vetted, reusable public FAQs (navigation, product, account, billing).
insert into public.faq_cache(query_key, topic, answer, expires_at) values
 ('how do i export my data','account','Open Account, then choose Export my data to download your records as a JSON file.', now() + interval '365 days'),
 ('how do i download my data','account','Open Account, then choose Export my data to download your records as a JSON file.', now() + interval '365 days'),
 ('how do i delete my account','account','Open Account, then choose Delete account. Type DELETE to confirm. Download your data first.', now() + interval '365 days'),
 ('how do i reset my password','account','Use the password reset option on the sign-in screen.', now() + interval '365 days'),
 ('how do i contact support','account','Email Lizalisenzo@gmail.com for support.', now() + interval '365 days'),
 ('how much does premium cost','billing','Premium costs R100 for 30 days, renewed manually through Yoco. There is no automatic debit.', now() + interval '365 days'),
 ('what does premium cost','billing','Premium costs R100 for 30 days, renewed manually through Yoco. There is no automatic debit.', now() + interval '365 days'),
 ('how do i cancel premium','billing','Premium is manual and does not auto-renew, so it simply ends after 30 days. Email Lizalisenzo@gmail.com for help.', now() + interval '365 days'),
 ('what does premium include','product','Premium unlocks personalised programmes, daily meal plans, barcode lookup, advanced reports and weekly check-ins.', now() + interval '365 days'),
 ('what is premium','product','Premium unlocks personalised programmes, daily meal plans, barcode lookup, advanced reports and weekly check-ins.', now() + interval '365 days'),
 ('where is the calorie bank','navigation','The Calorie Bank is the Calorie Bank tab in the bottom navigation.', now() + interval '365 days'),
 ('how do i change my workout style','navigation','Open Account, then choose Workout style and pick a new goal.', now() + interval '365 days'),
 ('how do i change my goal','navigation','Open Account, then choose Workout style and pick a new goal.', now() + interval '365 days'),
 ('how do i build a new programme','navigation','Open Account, then choose Build a new programme.', now() + interval '365 days');
