-- BATCH 9: CLEANUP CAMPUS ANNUAL CALENDAR DUPLICATE ROWS
-- Keeps only ONE unique row per (title, from_date) in public.campus_annual_calendar
-- Safe to run in Lovable / Supabase SQL Editor.

delete from public.campus_annual_calendar a
where a.id not in (
  select distinct on (lower(trim(title)), from_date) id
  from public.campus_annual_calendar
  order by lower(trim(title)), from_date, created_at desc
);
