# Batch 5 — changes (no database change needed)

Upload these files over the same paths in GitHub. Nothing to run in Supabase.

1. Name: "शिक्षक डायरी" with small "Teacher's Diary" below (sidebar, phone header, login, home).
   Files: src/components/app/Shell.tsx, AppNav.tsx, src/routes/login.tsx, index.tsx
2. My account: three options - View profile / Change password / Change theme.
   Profile shows name, ID, role, designation, department, campus, address, HOD, chief.
   File: src/routes/account.tsx
3. Setup: weekly holidays and the "Campus & teacher" details can be changed only by the administrator
   (other teachers see them read-only). File: src/routes/setup.tsx
4. Plans: "Start from the previous plan" (daily/weekly/monthly/annual work plan) and
   "Copy last year's units" for the annual plan of the same subject. File: src/routes/plans.tsx
5. Export: PDF / Print, Word and Excel buttons on Plans and Reports. File: src/components/app/ui.tsx

NOT in this batch (needs new database tables, planned for Batch 6):
institutional profile, departments > programs > semesters, students at campus level with
three-dot menu / promote, teacher phone + email on the new-account form, academic year in Setup.
