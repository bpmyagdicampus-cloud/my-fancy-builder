# Batch 6 — database steps (run by YOU after a backup)

Run in this order in the SQL editor of the SAME database the app uses (Lovable Cloud):
1. `30_campus.sql`   (campus profile, departments, department heads, central class list)  — already run
2. `32_class_link.sql` (links SQC classes to the classes created in Setup)

Both only ADD tables / a column / a function. Nothing is deleted. Safe to run twice.

Classes are created ONLY in Setup -> Classes (choose the department). SQC shows them automatically
("Refresh from Setup" button in SQC -> Setup -> Classes). Only the administrator and a department head
can create a new class; other teachers choose an existing one.
