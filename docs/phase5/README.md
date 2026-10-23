# Batch 6A — Campus structure (database step, run by YOU after a backup)

1. Take a backup first (Supabase dashboard, and Teacher profiles -> Backup in the app).
2. Open Supabase -> SQL editor -> paste the whole of `30_campus.sql` -> Run.
   It only ADDS new tables/functions. Nothing existing is changed or deleted. Safe to run twice.
3. Upload the app files (zip) to GitHub. Vercel builds the new "Campus" page.
4. In the app (as administrator): Campus -> Departments -> add departments -> appoint a teacher as head.
   Then Programs & classes -> add programs (MBS, MA, ...) and classes (Year / Semester). Then Students.

Who can do what (enforced by the database, not only by the screen):
- Administrator: everything.
- Department head (a teacher appointed by the administrator): programs, classes and students of OWN department only.
- Other teachers: can view programs and classes. They cannot see or change students yet (Batch 6B adds
  "teacher picks a class and sees its students").
