# Three-month mock history fixture

Batch: `GYMIQ_MOCK_90D_20261103`. Requested account: Lizalise Nzo. Period: 3 August–2 November 2026. This is synthetic test information, not evidence of actual training or health outcomes.

Added 55 finished and two cancelled workouts; five further scheduled workouts were skipped (seven missed/cancelled opportunities altogether). The history contains gradual load/repetition progression, a lighter week, several shortened sessions, warmups, left/right working sets, effort ratings and readiness variation. The mock batch has 1,056 raw sets, including warmups and cancelled-session sets; those excluded categories do not count as achieved working-set statistics.

Added 327 food entries across 85 days: 70 complete diary days and 15 partially logged days, with six deliberate no-log gaps plus the existing diary day preserved. The meal templates are ordinary mixed-diet meals from GymIQ’s validated catalogue; portion variation and occasional calorie-only extras produce realistic incompleteness. Added historical meal plans and dated calorie guides, keeping plans separate from intake and preserving the current saved goal.

Added 39 synthetic weigh-ins with a gradual, uneven trend near 84.5 kg to 80.6 kg, plus 19 recorded rest days. Existing weigh-ins/dates were skipped. The actual current weigh-in and all existing raw workouts, sets, food and programme records were verified unchanged after insertion. Current membership, billing, account creation date and access permissions were not edited.

The existing active programme begins on 24 August. Earlier mock sessions are imported freestyle history, visible in history, exercise analytics and monthly reports; programme-week navigation still starts when that real programme began. Weekly make-up snapshots were recalculated using the same bounded app helper to match the mock history, without adding an accumulating backlog. Existing snapshots were backed up.

## Generation and verification

The scripts in `scripts/fixtures` generate SQL files only; they contain no credentials and do not connect to the database. Generation requires a private pre-seed snapshot of the explicitly requested account and the expected five-day/30-exercise programme. The SQL checks the account identity, uses one transaction and rejects a duplicate batch.

Private files under ignored `artifacts/aged-account/` include the pre-seed backup, generated data, apply/dry-run SQL, batch summary, live validation data and prepared removal SQL. Do not add these personal snapshots to Git. The generator and SQL template are reviewable source; actual data files are not published.

Validation completed before applying: full seed rolled back; authenticated data reads/pagination and food-period summaries; cross-account isolation; make-up limits; seed-plus-removal roundtrip rolled back with original table counts restored. After applying: original raw records compared byte-for-byte as JSON, mock counts/date range confirmed, and the actual paged data passed through exercise progress, training analytics, monthly progress and weekly check-in engines.

To reproduce generation locally with an approved private snapshot:

```text
node scripts/fixtures/generate-aged-account.mjs
node scripts/fixtures/prepare-aged-cleanup.mjs
node scripts/fixtures/verify-aged-account.mjs
```

The verifier additionally requires a fresh account-scoped `live-app-data.json` read from the same application RPCs. Do not rerun live insertion: the mock batch already exists. Removal SQL is prepared for a future explicit removal request, not automatic execution. It removes marked mock records, restores comparable saved weekly snapshots, and rebuilds affected PR/habit summaries while retaining original and subsequently added genuine activity. Food diary completeness may need reconfirmation after removing foods, as required by the app’s normal correction rules.

These fixtures are for testing. Any PRs, calorie trends or AI recommendations on this account now include synthetic history until the batch is removed.

## Requested consistent replacement

On 3 November, the owner requested removal of inaccurate manual workout, food and weight records, replacing them with a coherent history. A local-only, ignored `prepare-consistent-reset.mjs` helper prepares that account-specific transaction from a fresh private backup in `artifacts/aged-account/reset-20261103/`. The helper and generated SQL are not published. It guards the account identity and expected original record counts before changing anything. It preserves existing clean fixture workouts, fills their missing dates, updates known fixture foods/plans, and rebuilds PRs, habits, diary completion and programme-week summaries. Sync receipts remain to prevent previously synced manual workouts from reappearing.

The prepared result has 60 finished workouts, two cancelled workouts, 334 food entries over 87 days and 40 weigh-ins through 3 November. Today's workout is in the morning; dinner remains planned rather than logged. Meals from the current goal's effective date use its saved 2,218 kcal guide. Account settings, programme definitions, goals, billing, saved meals, coach conversations and the automatic calorie deposit are preserved. The old `remove-mock-data.sql` is **not** the replacement transaction; it restores the prior manual history instead.

Generation is separate from application. Live removal requires the Supabase connector's destructive-query confirmation; a generated SQL file or expired confirmation does not mean the data was changed. Run the dry-run transaction first, inspect its results, then apply and validate the resulting records. Keep the private before/after snapshots out of Git.

The coach reads up to three months of scoped history, with paged working sets, weekly session totals, earliest/latest exercise comparisons and weighted supporting-muscle volume. It treats saved records as observations, prioritises current structured history over older chat remarks, and does not speculate that consistent records are synthetic or corrupted. Fixture metadata remains available internally for auditing/removal.
