# FULL snapshot — all phases and batches in ONE package

Use THIS zip instead of the earlier phase/batch zips. It contains every file that differs from the original repository
(55 files in src/, docs/, scripts/). Upload the `src`, `docs` and `scripts` folders to GitHub and commit.
It is safe to apply on top of any earlier partial upload (files are simply replaced with the correct, matching versions).

After committing, these files MUST exist in GitHub (check a few):
  src/lib/id.ts  src/lib/students.ts  src/lib/years.ts  src/lib/migrate.ts  src/lib/store.ts  src/lib/cloud.ts
  src/lib/sqc.ts  src/lib/sqc-data.ts  src/lib/login.ts  src/lib/image.ts  src/lib/admin.functions.ts
  src/components/app/Shell.tsx  src/components/app/Guard.tsx  src/components/app/auth.tsx
  src/components/sqc/ReportForm.tsx  ReportList.tsx  Summary.tsx  SqcSetup.tsx  PeriodPicker.tsx
  src/routes/login.tsx  admin.tsx  account.tsx  students.tsx  years.tsx  sqc.tsx
