# Batch 6A (version 2) — Campus set-up inside Setup

Database step (run by YOU, after a backup):
1. Supabase -> SQL Editor -> New query -> paste ALL of `30_campus.sql` -> Run.
   It only ADDS new tables/functions. Works whether or not you ran the first version.
2. Upload the app files (zip) to GitHub. Vercel builds it.
3. Open Setup. At the top: campus name and details (everyone sees), then Departments -> Classes -> Students.

Who can do what (enforced by the database, not only by the screen):
- Administrator: edits the campus profile, departments, department heads, classes and students.
- Department head (a teacher appointed by the administrator): classes and students of OWN department.
- Other teachers: can view everything, change nothing here.
