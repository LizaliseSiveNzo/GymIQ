# Owner reporting

The lazy-loaded `/owner` route is linked from Account only after the authenticated `owner-dashboard` Edge Function confirms access. It works independently of the owner's customer membership expiry. The function verifies the session through Auth, checks the server-managed `owner_dashboard_access` table, and calls a service-role-only reporting RPC with the verified user ID. The browser receives a limited report, never service credentials or raw customer meal, weight, set or chat data. Reports are held in component memory and are not saved in the offline cache.

Provision owner access and reporting exclusions using the server/database administration tools after verifying the intended account. Neither `users.role` nor editable Auth metadata grants owner access. No client can edit the access/exclusion tables or directly execute the report RPC. Existing test accounts were excluded during provisioning; new fixture accounts can be added to `owner_reporting_exclusions`. Accounts with marked mock workout history and owner-access rows are also automatically excluded. The customer list can optionally show these accounts, while all business totals continue excluding them.

The reporting function remains `SECURITY INVOKER` and reads existing GymIQ profile records. It does not query private Auth records or add permissions to the Auth schema. New profile creation is part of the existing signup trigger; registration dates use that profile creation time.

## Definitions

- Customer registration dates come from account profile creation, not imported programme/workout dates. Profiles awaiting email confirmation still count as sign-ups; email verification is not presented as a dashboard metric.
- Activity means synced finished workouts or food entry creation, not app opens or sign-ins. Cancelled workouts, future timestamps and marked mock activity are omitted. Days are calculated in Africa/Johannesburg.
- Weekly activity/sign-ups use seven inclusive local calendar days; monthly activity/revenue use thirty. Charts cover twenty-eight days. The mature week-two cohort joined 14–20 days ago, and counts returning activity on days 7–13 after joining. A zero-sized cohort has no percentage.
- Paying memberships need current paid access and a confirmed live payment. Revenue counts live ZAR payments with a payment ID and confirmation time; it is gross before fees/refunds. Pending checkouts and test-mode payments contribute nothing. A renewal is a user's second or later confirmed live payment, not assumed recurring revenue. Upcoming renewals are paid access expiries in the next seven days.
- Filters/search affect the paginated customer list only. Search is limited to name/email, membership filters use the same server definitions, and results are capped at twenty-five per page.

## Referrals and reliability

`?ref=source-code` links retain the first valid code locally for up to thirty days. Signup includes the code in non-authoritative metadata. A trigger records it once on profile creation; invalid or missing codes become `direct`. Older sign-ups are `unknown`, not retrospectively attributed. Codes accept lowercase letters, digits, hyphens and underscores, up to sixty-four characters. Local storage failure cannot block registration. The dashboard generates links and QR codes locally; it does not send messages or register campaigns with an external service.

Optional best-effort reliability counters record only authenticated user ID, local day, failure category and a throttled count. No raw error strings, food contents, body measurements, page contents or device IDs are submitted. Counts cover sync and workout-finish failures since deployment; fully offline failures may not arrive. Reporting failures never block saving or alter queued logs.

The privacy notice describes owner reporting, referral attribution and diagnostics. The dashboard does not add advertising trackers or session recording.

## Verification

`scripts/verification/owner-dashboard.sql` creates temporary customers/payments/activity in a transaction, checks revenue, activity, cancelled-workout exclusion, week-two retention, referrals, search, pagination, account exclusions, access control and diagnostic throttling, then rolls everything back. It requires existing owner provisioning. Referral and nonblocking diagnostics tests run with the normal web test suite. Customer and owner isolation must also be checked through the deployed Edge Function.
