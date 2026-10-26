# Batch 6C
1. SQC representative
   - SQL 33_student_role.sql (run ALONE, first): makes sure the Student role exists (fixes "cannot give the role").
   - SQL 34_sqc_scope.sql: a representative sees teachers of OWN department only (profile department = department name,
     department head, or teaches the class) and the SUBJECTS of own class (taken from the classes teachers linked in Setup).
   - Report form: subject becomes a list for the class; choosing a subject also picks its teacher. "Other" still allowed.
   - Admin -> New account: the SQC class list is refreshed from Setup classes first.
2. Setup -> Teacher details: every teacher can edit and save their own details. Weekly holidays stay administrator-only.
3. Setup -> Classes: visible Edit and Delete buttons on every class. Delete is refused (with the reason) when the class has
   any data (students, diary, plans, units, lessons, marks, earlier years). Only the administrator / department head can change
   a class's department or class; other teachers can still edit subject, code and hours.
Files: src/components/app/ClassFields.tsx, ui.tsx, src/lib/classes.ts (new), sqc-data.ts, src/routes/setup.tsx, sqc.tsx, admin.tsx,
 src/components/sqc/ReportForm.tsx, docs/phase5/33_student_role.sql, 34_sqc_scope.sql, README.md
