# Audit — cloud data safety (Batch 1)

Nothing in this batch changes the database, runs a migration or touches existing data.

| # | Finding | Where | Status |
|---|---|---|---|
| A1 | Failure to create the missing `teacher_data` row was ignored | cloud.ts loadTeacher | Fixed: clear error screen with "Try again"; nothing is saved or shown as empty data |
| A2 | Sign-out after a failed save discarded the unsaved work | cloud.ts signOut | Fixed: backup file is downloaded AND a recovery copy stays on the device (My account → Unsaved copies) |
| A3 | Admin could open another diary while the current one was unsaved | cloud.ts openTeacher | Fixed: blocked until saved |
| A4 | Moving old data to the cloud replaced the cloud diary without keeping it | cloud.ts importLocalToCloud | Fixed: cloud copy downloaded first, record counts shown, blocked while unsaved |
| A5 | Changing a role deleted the old role first | admin.functions.ts | Fixed: new role added first, then the rest removed |
| A6 | No manual retry after a failed save | AppNav.tsx | Fixed: “Try again now” button |
| A7 | No version history in the cloud (a wrong overwrite cannot be undone) | database | NOT changed — needs a new table; waiting for approval |
| B1 | Restoring a backup while signed in switched the app to the on-device profile; edits would stay on the device only | store.ts / profiles.tsx / cloud.ts | Fixed (restore keeps the cloud diary open; safety net in the sync layer) |
| B2 | Reload while offline showed an error instead of the diary | cloud.ts | Fixed: opens from the device copy, uploads when online (version-checked) |
| B3 | Server functions threw errors that could reach the screen as an unreadable error page | admin.functions.ts | Fixed: results are returned as { ok, error } with the real reason |

## Verification status
- Automated, run by the assistant (simulation with a fake in-memory Supabase): `node scripts/cloud-sim.cjs` — 19 checks.
- Automated, run by the assistant: logic tests for years/students/leave migration (src/test/*.test.ts, executed through a small shim, not through vitest).
- NOT run by the assistant: vitest, lint, production build, any browser/viewport test, the real Supabase (RLS, auth, storage), two real browsers.
- To check RLS on the real project: run `verify_rls_readonly.sql` (read-only) and the steps in `MANUAL_TESTS.md`.
