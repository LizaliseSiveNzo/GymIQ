# Reliable workout set entry

## Fixes

- Pausing controls the timers, not data entry. Unlogged weight/reps/RIR and set-completion controls remain usable while paused. Logging a set resets its rest duration but does not start a paused clock.
- Synced saved values are read-only but tappable: they open the existing correction editor. The inline Edit control remains available. Pending device saves clearly say they need to sync before correction/undo; other sets remain usable.
- Working rows map to recorded set numbers rather than positions in the returned array. Logging set 3 before set 2, or undoing an earlier set, no longer moves another saved row into the wrong position. Warmup ordinals are reserved rather than colliding with working sets.
- Per-row in-flight locks, stable mutation IDs in timer recovery, and a short toggle guard prevent duplicate saves and fast save-then-undo double taps. Invalid input/device failures release the guard for an immediate corrected retry.
- Durable device save acknowledges the UI directly. It no longer waits for a redundant IndexedDB list read after the save. Queue acknowledgements must identify the exact saved entry before the device copy is removed. The existing server receipt mechanism remains responsible for safe retries after lost responses.
- Row-specific busy/error states preserve typed data and leave other rows available. Completion targets are 44 × 44 pixels; input font is 16px to avoid small-font focus zoom on phones. RIR controls no longer overlay the reps input.
- Validate all weights and whole reps before queuing instead of silently truncating fractional reps or treating invalid weight as zero. Decimal commas in weight entry are accepted; bodyweight remains explicit 0 kg.
- Undo uses a bounded, atomic owner-checked RPC that locks the session, rejects finished/cancelled sessions and compares the expected set values before deleting. Lost undo responses can retry without resurrecting data. Synced-set correction fails promptly offline and has a 12-second UI timeout even if the underlying operation stalls. A timeout explains that the result may have reached the server and should be checked, rather than claiming it was never saved.

No workout data is reset or rewritten by this release. Already-saved rows in unfinished workouts remain saved; correction and adding another set are explicit actions. Server RLS, membership checks, edit compare-and-swap and immutable sync receipts remain unchanged.

## Verification

- Unit coverage: out-of-order rows, undo gaps, warmups/incomplete rows, strict numeric validation, decimal commas, zero-weight sets, repeated acknowledgements, per-row concurrent saves, failures releasing locks, double-tap guard, stalled requests and exact sync acknowledgements.
- Production-build browser fixture with synthetic records: log while paused, reject fractional reps, log set 3 before 2, double-tap completion, undo row 1 without moving rows 2/3, tap saved weight to edit, correct a set, recover from a stalled correction, add/log an offline set, lose a server acknowledgement and retry without duplication, then recheck the undone set with a fresh mutation ID.
- Existing offline, queue, recovery, timer and progression tests continue to pass. No real customer records are modified by the browser fixture.
