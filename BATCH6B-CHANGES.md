# Batch 6B — one class system, Upgrade Students
- Setup -> Classes (the original list below Weekly holidays) now has a Department field (Management by default, list loaded from
  the department records) and a class chooser. The separate class creation under Departments is gone.
  Administrator / department head can create a new class there; other teachers pick an existing one.
- Classes are grouped by department (chips). Older classes count as Management; one button links them all.
- SQC: no separate "create class". It uses the Setup classes (sqc_sync_classes). Existing SQC classes keep their id
  and are linked by name, so SQC reports, members and history are untouched.
- "Students" is no longer a top-level menu item: Setup -> "Upgrade Students" button. The page is "Upgrade Students":
  per-student Move (as before) + new "Move a whole class" (counts all students of the class, keeps Active as it is,
  reports students that could not move). Active checkbox unchanged.
Files: src/lib/store.ts, src/lib/campus.ts, src/lib/sqc-data.ts, src/components/app/ClassFields.tsx (new), ui.tsx, CampusSetup.tsx,
 Shell.tsx, src/routes/setup.tsx, students.tsx, sqc.tsx, src/components/sqc/SqcSetup.tsx, docs/phase5/32_class_link.sql, README.md
