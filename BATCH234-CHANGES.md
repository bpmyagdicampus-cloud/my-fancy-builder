# Batches 2, 3 and 4 (apply AFTER Batch 1)

DATABASE: batches 3 and 4 need the two SQL files in docs/phase4 (run by you, after a backup). Without them the app still works;
the academic-year control and the SQC screens just say they are not set up yet.
No new npm packages. Nothing existing is changed or deleted by the SQL (additive only).

New:      src/components/app/Shell.tsx, src/components/sqc/*.tsx (5 files), src/lib/sqc.ts, src/lib/sqc-data.ts,
          src/routes/sqc.tsx, src/test/sqc.test.ts, docs/phase4/*, docs/ui/UI_TESTS.md
Replaced: src/routeTree.gen.ts, src/styles.css, scripts/cloud-sim.cjs
Edited:   src/components/app/AppNav.tsx, src/components/app/auth.tsx, src/components/app/ui.tsx,
          src/routes/__root.tsx, src/routes/admin.tsx, src/routes/years.tsx, src/routes/index.tsx,
          src/lib/cloud.ts, src/lib/admin.functions.ts

Order: 1) upload files  2) check the new look (docs/ui/UI_TESTS.md)  3) take a backup, run 10_academic_years.sql then 20_sqc.sql
       4) run verify_sqc_readonly.sql and send the result  5) docs/phase4/SQC_MANUAL_TESTS.md
