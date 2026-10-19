# Batches 3 and 4 — database steps (ADDITIVE, run by YOU after a backup)

Nothing here is run automatically. Nothing existing is changed or deleted.

1. Take a backup (Teacher profiles -> Backup, and the Supabase/Lovable Cloud backup if available).
2. Run `10_academic_years.sql`, then `20_sqc.sql` (in this order) in the SQL editor. "Run anyway" on the ALTER/CREATE warnings is normal.
3. Run `verify_sqc_readonly.sql` (read-only) and send the result table to be reviewed.
4. Follow `SQC_MANUAL_TESTS.md`.
The app keeps working if these two files are not run yet: the new screens simply say the feature is not set up.
