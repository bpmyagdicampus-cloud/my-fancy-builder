-- BATCH 7: CAMPUS ANNUAL CALENDAR & CLASS-WISE ACADEMIC CALENDARS
-- 1. campus_cal_types: Admin-customizable event types (replaces hardcoded types)
-- 2. campus_annual_calendar: Central campus annual events managed by Admin and shown on everyone's Home page
-- 3. dm_academic_calendars: Departmental class-wise matrix academic calendars (photo format)
-- Safe to run more than once. Additive only.

create table if not exists public.campus_cal_types (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  color      text not null default 'blue',
  is_holiday boolean not null default false,
  created_at timestamptz not null default now(),
  constraint campus_cal_types_name_unique unique (name)
);

create table if not exists public.campus_annual_calendar (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(trim(title)) > 0),
  event_type  text not null default 'Event',
  from_date   text not null check (from_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  to_date     text check (to_date is null or to_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  description text not null default '',
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.dm_academic_calendars (
  id             uuid primary key default gen_random_uuid(),
  department_id  uuid not null references public.departments(id) on delete restrict,
  academic_year  text not null,
  class_id       text not null,
  class_name     text not null,
  start_month    integer not null default 7,     -- 7 = Kartik (BS), 1 = Baishakh
  end_month      integer not null default 4,     -- 4 = Shrawan (BS), 12 = Chaitra
  months         jsonb not null default '[]'::jsonb,
  particulars    jsonb not null default '[]'::jsonb,
  status         text not null default 'draft' check (status in ('draft', 'submitted', 'approved')),
  approval_note  text not null default '',
  prepared_by    uuid references auth.users(id) on delete set null,
  prepared_name  text not null default '',
  approved_by    uuid references auth.users(id) on delete set null,
  approved_name  text not null default '',
  approved_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint dm_academic_calendars_unique unique (department_id, academic_year, class_id)
);

create index if not exists dm_academic_calendars_dept_year_idx on public.dm_academic_calendars (department_id, academic_year);

-- Insert default event types if table is fresh
insert into public.campus_cal_types (name, color, is_holiday) values
  ('Regular classes', 'slate', false),
  ('First-Term Examination', 'amber', false),
  ('Second-Term Examination', 'amber', false),
  ('Third-Term Examination', 'amber', false),
  ('Final / Board Exam', 'rose', false),
  ('Dashain–Tihar holiday', 'red', true),
  ('Winter holiday', 'sky', true),
  ('Summer holiday', 'orange', true),
  ('Public holiday', 'red', true),
  ('Course Orientation', 'blue', false),
  ('Result & Prize Distribution', 'emerald', false),
  ('Remedial Classes', 'purple', false),
  ('Guest Lecture', 'teal', false),
  ('Event / Activity', 'blue', false)
on conflict (name) do nothing;

-- RLS
alter table public.campus_cal_types enable row level security;
alter table public.campus_annual_calendar enable row level security;
alter table public.dm_academic_calendars enable row level security;

revoke all on public.campus_cal_types, public.campus_annual_calendar, public.dm_academic_calendars from anon;
grant select on public.campus_cal_types, public.campus_annual_calendar, public.dm_academic_calendars to anon, authenticated;
grant insert, update, delete on public.campus_cal_types, public.campus_annual_calendar, public.dm_academic_calendars to authenticated;

-- Types: readable by all authenticated users; writable by admin
drop policy if exists campus_cal_types_read on public.campus_cal_types;
create policy campus_cal_types_read on public.campus_cal_types for select to public using (true);
drop policy if exists campus_cal_types_write on public.campus_cal_types;
create policy campus_cal_types_write on public.campus_cal_types for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Campus annual calendar: readable by all authenticated users (shown on Home); writable by admin
drop policy if exists campus_annual_cal_read on public.campus_annual_calendar;
create policy campus_annual_cal_read on public.campus_annual_calendar for select to public using (true);
drop policy if exists campus_annual_cal_write on public.campus_annual_calendar;
create policy campus_annual_cal_write on public.campus_annual_calendar for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Departmental class academic calendar:
-- Read: anyone who can read department data (public.dm_can_read) or staff
-- Write: HOD or Admin (public.can_manage_dept)
-- Approve: Admin only
drop policy if exists dm_academic_calendars_read on public.dm_academic_calendars;
create policy dm_academic_calendars_read on public.dm_academic_calendars for select to authenticated
  using (public.dm_can_read(department_id) or public.is_staff_user());

drop policy if exists dm_academic_calendars_write on public.dm_academic_calendars;
create policy dm_academic_calendars_write on public.dm_academic_calendars for all to authenticated
  using (public.can_manage_dept(department_id))
  with check (public.can_manage_dept(department_id));
