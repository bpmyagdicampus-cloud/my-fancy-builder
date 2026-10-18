-- STEP 1 of 3 — run this ALONE, first.
-- Adds the "student" role. (Postgres needs this to be committed before it can be used.)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'student';
