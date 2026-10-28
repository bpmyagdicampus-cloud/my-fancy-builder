# Phase 3 — academic years, student IDs, class changes, subject upgrade (apply AFTER Phase 2)

No SQL and no new npm packages. Existing data is converted automatically on first load
(a copy of the old data is still kept in the browser under "shikshak-diary-v1-before-update" from Phase 1).

New:      src/lib/id.ts, src/lib/students.ts, src/lib/years.ts, src/routes/students.tsx, src/routes/years.tsx, src/test/phase3.test.ts
Replaced: src/lib/store.ts, src/lib/migrate.ts, src/routeTree.gen.ts
Edited:   src/components/app/ui.tsx, src/components/app/AppNav.tsx, src/routes/index.tsx, src/routes/setup.tsx,
          src/routes/diary.tsx, src/routes/records.tsx, src/routes/profiles.tsx

Test checklist
 - Everything from before is still there (36 diary entries, 5 classes, assessments, leave).
 - Top bar shows the year chip (2083/84) and a Students tab.
 - Students: BBS II shows 6, BBS III 5, MBS II 3. BBS I is empty: use "Add N names found in old records".
 - Rename one student: open Daily Diary / Reports -> the new name appears in old attendance.
 - Academic years -> Start new academic year (try it, then reopen 2083/84 from the list: nothing is lost).
 - Upgrade subject on one class: old class becomes "closed", students move to the new class.
