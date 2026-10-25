# Database steps — full order (run in the Supabase SQL Editor, one file at a time, after a backup)

Run every file below in this order. Each one is safe to run again, so it does not matter what was run before.

1. `docs/phase2/01_add_student_role.sql` (run alone)
2. `docs/phase2/02_accounts_and_storage.sql`
3. `docs/phase2/03_make_first_admin.sql` (put your e-mail in it; your user must exist in Authentication -> Users)
4. `docs/phase4/10_academic_years.sql`
5. `docs/phase5/30_campus.sql` (departments, central class list `setup_classes`, students)
6. `docs/phase5/40_sqc_central_classes.sql` (SQC on the central classes)

Do NOT run `docs/phase4/20_sqc.sql` or `docs/phase5/32_class_link.sql` — they are replaced by file 6.
If they were run in the past, file 6 moves their SQC reports and members onto the Setup classes without deleting anything.
