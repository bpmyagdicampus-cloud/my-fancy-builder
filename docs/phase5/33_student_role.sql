-- STEP 1 of 2 (run this ALONE, first): make sure the "student" role exists.
-- Without it, creating a student account or giving someone the Student role fails.
-- Safe to run more than once. Changes nothing else.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'student';
