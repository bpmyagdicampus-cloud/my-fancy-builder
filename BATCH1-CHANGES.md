# Batch 1 — cloud data safety + new-user fix (apply AFTER Phase 3)

No database change, no SQL to run, no new packages.

Replaced: src/lib/cloud.ts, src/lib/admin.functions.ts, src/lib/store.ts
Edited:   src/routes/admin.tsx, src/routes/account.tsx, src/routes/profiles.tsx,
          src/components/app/auth.tsx, src/components/app/AppNav.tsx
New:      scripts/cloud-sim.cjs, docs/audit/README.md, docs/audit/MANUAL_TESTS.md, docs/audit/verify_rls_readonly.sql

After uploading: follow docs/audit/MANUAL_TESTS.md (section E first: create a user).
Run the simulation yourself (optional): node scripts/cloud-sim.cjs
