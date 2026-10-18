# Phase 1 — changes (Shikshak Diary)

Copy these files over the same paths in your GitHub repo (replace/add), commit, let Lovable sync, then test.

New:      src/lib/migrate.ts, src/test/phase1.test.ts, PHASE1-CHANGES.md
Replaced: src/lib/store.ts
Edited:   src/lib/constants.ts, src/lib/bs.ts, src/components/app/ui.tsx, src/components/app/AppNav.tsx,
          src/routes/profiles.tsx, src/routes/records.tsx, src/routes/setup.tsx, src/routes/reports.tsx, src/routes/diary.tsx

What it does
1. Sunday is a weekly holiday too (Setup -> Weekly holidays; Sat + Sun by default). Used in the monthly report and in diary warnings.
2. Personal leave moved to Records -> Leave. Not shown in the academic calendar; still counted in the monthly report (days + remarks).
   Existing "Personal leave" calendar entries are moved automatically (nothing else changes).
3. Print: Portrait / Landscape selector next to the Print button (remembered).
4. Safety: a corrupted/unreadable saved file no longer gets overwritten by an empty one; failed saves show a message;
   one untouched copy of the old data is kept in the browser (key "shikshak-diary-v1-before-update");
   banner when no backup for 7+ days; import checks the backup file; stronger random IDs;
   warning when saving a diary entry on a holiday/leave day or a second entry for the same class+date.

Test checklist
 - Open the app: all classes, diary (36), assessments etc. are still there.
 - Records -> Leave shows the 2083-05-22 leave; Setup -> academic calendar no longer lists it.
 - Reports -> Monthly (Baishakh..): Sat and Sun shaded; leave day counted.
 - Reports -> Print: choose Landscape and check the preview.
 - Teacher profiles -> Backup, then see the banner disappear.
Note: a backup made AFTER this update has a "leaves"/"settings" section; importing it into the OLD version would lose the leave entry.
