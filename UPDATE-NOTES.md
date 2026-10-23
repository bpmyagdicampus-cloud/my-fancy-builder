# Update notes — October 23, 2026

## Changes included

- Kept the app name **शिक्षक डायरी** with the smaller **Teacher's Diary** subtitle.
- Reworked Setup around Institutional Profile, Departments, Classes & Students, Weekly Holidays, Academic Calendar and Academic Year links. There is no separate Campus or Student item in the main navigation; Programs are no longer presented as a separate setup list, and class names can be entered directly (for example, BBS I, BBS II, MBS Semester I).
- Institutional Profile includes campus name, address, website, email, phone, Department Head and Campus Chief. Reports/plans, dashboard and account profile use these values where applicable.
- Restricted Institutional Profile, department directory, weekly holidays, academic calendar and new/renamed academic years to the Admin role (except local on-device mode). Other signed-in users can view the campus setup. Department Head retains the Teacher role and, when assigned to a department by Admin, can manage classes/students in that department in their own diary.
- Added Admin account creation/management controls for role and department assignments, including Department Head + Teacher.
- Added class-level student creation, editing, archive/restore and promote/move actions. Removing a student archives the record rather than permanently deleting it; moving students retains prior class IDs in their history.
- Added previous annual-plan unit copying and previous daily/monthly-plan copying as new records without overwriting the source plan.
- Added profile view, password change, theme controls and profile JSON backup on My Account.
- Added Office-compatible Excel/Word exports to Plans and Reports; Print dialog can be used to save as PDF.
- Improved Dashboard layout and summaries.
- Added backup/restore notes and Phase 5 SQL migrations for the Department Head role and shared institutional profile/departments.

## Database / deployment steps

1. Download a JSON backup for each teacher profile and take a Supabase database backup if available.
2. If missing, apply `docs/phase4/10_academic_years.sql`.
3. Apply `docs/phase5/00_add_department_head_role.sql` **by itself**, wait for success, then apply `docs/phase5/01_shared_campus_settings.sql`.
4. Sign in as Admin after the Phase 5 migration. If the shared campus settings row is still empty, the app attempts to seed it from the Admin's existing institutional settings and department list.
5. Verify in a test account before regular production use.

The ZIP does not connect to or modify the live Supabase database. SQL must be applied by the project owner after a backup.

## Important limitations

- Classes, students, plans, attendance and other diary records remain in each teacher's own `teacher_data` JSON record. This release does not yet implement a campus-wide shared class/student master register. The Department Head's class/student edits therefore do not automatically synchronize to every other teacher's diary.
- Exported `.xls` and `.doc` files contain HTML compatible with Excel/Word; they are not native `.xlsx` or `.docx` files. PDF output uses the browser's Print / Save PDF dialog.
- The existing localStorage/cloud-sync design was retained to reduce migration risk. This ZIP does not introduce a new IndexedDB offline database or full automated database backups.

## Validation

- TypeScript/TSX syntax transpilation scan completed for 114 files with zero syntax errors.
- A full Vite production build and application test suite could not be completed in this environment because project dependencies could not be installed. Run `npm install`, `npm run build`, and `npm test` in the target environment and review any errors before deploying.
