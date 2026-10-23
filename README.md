# शिक्षक डायरी · Teacher's Diary

A teacher-focused academic planning, classroom management, activity tracking and reporting app built with React, TanStack Start and Supabase.

## Run locally

1. Use Node.js 22 or a compatible version supported by the project dependencies.
2. Keep your project `.env` file private. It contains project configuration; never publish it in a public repository or share it openly.
3. Install dependencies with `npm install`.
4. Start the development server with `npm run dev`.
5. Use `npm run build` to run a production build in an environment where dependencies are installed.

## Important Supabase setup

The app's existing diary content continues to use `teacher_data` and the existing Supabase auth/profile tables. This update adds an optional campus-wide institutional profile and department directory, plus the Department Head role. **Back up first** and review these SQL files before applying them to the live project:

1. If not already installed, run `docs/phase4/10_academic_years.sql` for the administrator-controlled academic-year list.
2. Run `docs/phase5/00_add_department_head_role.sql` by itself. Wait for it to finish.
3. Then run `docs/phase5/01_shared_campus_settings.sql`.
4. Run the existing `docs/phase4/20_sqc.sql` only if that feature's tables are not already installed and your deployment needs them.

These SQL migrations are not run automatically by the app or by this ZIP. Do not apply them to a live database until a backup exists and the SQL has been reviewed.

## Current data scope and limitations

- Institutional Profile and Department directory can be shared across signed-in accounts after the Phase 5 migration is installed. Only Admin can edit them; others see read-only values.
- Class lists, student rosters, lesson plans, attendance and other diary records still live in each teacher's own `teacher_data` content. This release does **not** create a single campus-wide class/student register, so a class or student created in one teacher's diary will not automatically appear in every other teacher's diary.
- The app continues to use its existing browser-local persistence and cloud sync approach; this update does not replace it with a new IndexedDB offline engine.
- Excel and Word exports are Office-compatible `.xls`/`.doc` HTML exports of the currently displayed page, not native `.xlsx`/`.docx` packages. PDF is produced through the browser's Print dialog (`Print / Save PDF`).
- Build and runtime validation must be completed in the target Lovable/Supabase environment after dependencies are installed. See `UPDATE-NOTES.md` for what was checked here.

## Backup

Read `docs/BACKUP-RESTORE.md`. Profile JSON backups are useful recovery copies, but they are not a full Supabase database and Storage backup.
