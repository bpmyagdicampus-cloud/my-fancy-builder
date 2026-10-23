# Batch 6A (version 2)
- No separate Campus / Students icon: everything is in Setup (top section "Campus").
- Campus name + details shown to everyone; Administrator edits. Choose Department -> Class -> Students from there.
- "Program" level removed: Department -> Classes (BBS I, BBS II ...) -> Students.
- Students: Edit / Inactive / Move / Remove buttons beside each student; "Upgrade whole class".
- Administrator and department head (own department) change classes and students; others view only.
- Old /campus address redirects to Setup.
Files: src/components/app/CampusSetup.tsx (new), src/lib/campus.ts, src/routes/campus.tsx, src/routes/setup.tsx,
       src/components/app/Shell.tsx, docs/phase5/30_campus.sql, docs/phase5/README.md
Run docs/phase5/30_campus.sql in Supabase BEFORE opening Setup.
