# Shikshak Diary update — Student Quality Control (SQC)

## Included in this package

- New `/sqc` route titled **Student Quality Control (SQC)**.
- Admin-only appointment of existing student accounts to class/academic-year assignments.
- Student-facing daily period records: date (BS), period, subject, teacher, arrival/departure, class status, total/present/absent counts, absent student details, absence notes and remarks.
- Issue/request reporting directly to administration with priority and status tracking.
- Daily/monthly/custom-period reports, submitted to administration, with summary and admin feedback.
- Row Level Security SQL migration for SQC tables.
- Student navigation and AuthGate updated to allow SQC without granting access to teacher diary screens.
- Cloud first-row initialization errors are now surfaced rather than silently ignored.

## Data safety

No existing teacher diary tables are dropped or rewritten. SQC data uses four new tables. Keep a fresh Supabase backup before applying the SQL migration. The included ZIP retains the existing project structure and existing environment configuration file from the uploaded archive; do not publish that file publicly.

## Database setup

Follow `docs/sqc/README.md`. The SQL migration must be applied to the same Supabase project used by the app. The SQL relies on the existing `public.has_role(auth.uid(), role)` helper and student role from Phase 2 setup.

## Verification status

Static source and archive checks are performed on this package. A full Vite build, browser test, real Cloud Save test, and two-account RLS isolation test require the project dependencies and the connected Supabase environment; they cannot be truthfully marked passed from this offline packaging environment. Complete the test checklist in `docs/sqc/README.md` before using this in production.
