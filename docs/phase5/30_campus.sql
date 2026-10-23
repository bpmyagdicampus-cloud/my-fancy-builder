-- BATCH 6A — Campus structure: institution, departments, programs, classes (year/semester), students.
-- ADDITIVE ONLY: creates new tables and functions. Nothing existing is changed or deleted.
-- Take a backup first. Safe to run more than once. Run in the Supabase SQL editor.
-- Needs the existing has_role() function and the academic/SQC steps (10_, 20_) already run.

-- ---------- tables ----------
create table if not exists public.campus_profile (
  id         smallint primary key default 1 check (id = 1),      -- exactly one row
  name       text not null default '',
  address    text not null default '',
  website    text not null default '',
  email      text not null default '',
  phone      text not null default '',
  updated_at timestamptz not null default now()
);
insert into public.campus_profile (id) values (1) on conflict (id) do nothing;

create table if not exists public.departments (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now(),
  constraint departments_name_key unique (name)
);

-- a department head is a normal teacher appointed (by the administrator) to one or more departments
create table if not exists public.department_heads (
  user_id       uuid not null references auth.users (id) on delete cascade,
  department_id uuid not null references public.departments (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (user_id, department_id)
);

create table if not exists public.programs (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete restrict,
  name          text not null,                                   -- MBS, MA, M.Ed, BBS, B.Ed, BA, BICTE ...
  created_at    timestamptz not null default now(),
  constraint programs_unique unique (department_id, name)
);

-- a "class" = one year or semester of a program (optionally a section)
create table if not exists public.campus_classes (
  id         uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete restrict,
  kind       text not null check (kind in ('Year', 'Semester')),
  no         smallint not null check (no between 1 and 12),
  section    text not null default '',
  created_at timestamptz not null default now(),
  constraint campus_classes_unique unique (program_id, kind, no, section)
);

create table if not exists public.campus_students (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references public.campus_classes (id) on delete restrict,
  name       text not null check (length(trim(name)) > 0),
  roll       integer not null default 0,
  active     boolean not null default true,                      -- false = left / old batch (kept, never lost)
  history    jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint campus_students_unique unique (class_id, name)
);
create index if not exists campus_students_class_idx on public.campus_students (class_id);
create index if not exists programs_dept_idx on public.programs (department_id);
create index if not exists campus_classes_program_idx on public.campus_classes (program_id);

-- ---------- helper functions ----------
create or replace function public.can_manage_dept(_dept uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin')
      or exists (select 1 from public.department_heads h where h.user_id = auth.uid() and h.department_id = _dept);
$$;
create or replace function public.campus_program_dept(_program uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select department_id from public.programs where id = _program;
$$;
create or replace function public.campus_class_dept(_class uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select p.department_id from public.campus_classes c join public.programs p on p.id = c.program_id where c.id = _class;
$$;
create or replace function public.is_staff_user() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'teacher');
$$;
revoke all on function public.can_manage_dept(uuid), public.campus_program_dept(uuid), public.campus_class_dept(uuid), public.is_staff_user() from public, anon;
grant execute on function public.can_manage_dept(uuid), public.campus_program_dept(uuid), public.campus_class_dept(uuid), public.is_staff_user() to authenticated;

-- ---------- row level security ----------
alter table public.campus_profile   enable row level security;
alter table public.departments      enable row level security;
alter table public.department_heads enable row level security;
alter table public.programs         enable row level security;
alter table public.campus_classes   enable row level security;
alter table public.campus_students  enable row level security;

revoke all on public.campus_profile, public.departments, public.department_heads, public.programs, public.campus_classes, public.campus_students from anon;
grant select, insert, update, delete on public.campus_profile, public.departments, public.department_heads, public.programs, public.campus_classes, public.campus_students to authenticated;

-- institution profile: staff read, administrator writes
drop policy if exists campus_profile_read on public.campus_profile;
create policy campus_profile_read on public.campus_profile for select to authenticated using (public.is_staff_user());
drop policy if exists campus_profile_admin on public.campus_profile;
create policy campus_profile_admin on public.campus_profile for update to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- departments: staff read, administrator writes
drop policy if exists departments_read on public.departments;
create policy departments_read on public.departments for select to authenticated using (public.is_staff_user());
drop policy if exists departments_admin on public.departments;
create policy departments_admin on public.departments for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- department heads: you see your own appointment; only the administrator appoints
drop policy if exists department_heads_read on public.department_heads;
create policy department_heads_read on public.department_heads for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
drop policy if exists department_heads_admin on public.department_heads;
create policy department_heads_admin on public.department_heads for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- programs: staff read (teachers choose from them); administrator or that department's head writes
drop policy if exists programs_read on public.programs;
create policy programs_read on public.programs for select to authenticated using (public.is_staff_user());
drop policy if exists programs_write on public.programs;
create policy programs_write on public.programs for all to authenticated
  using (public.can_manage_dept(department_id)) with check (public.can_manage_dept(department_id));

-- classes: staff read; administrator or that department's head writes
drop policy if exists campus_classes_read on public.campus_classes;
create policy campus_classes_read on public.campus_classes for select to authenticated using (public.is_staff_user());
drop policy if exists campus_classes_write on public.campus_classes;
create policy campus_classes_write on public.campus_classes for all to authenticated
  using (public.can_manage_dept(public.campus_program_dept(program_id)))
  with check (public.can_manage_dept(public.campus_program_dept(program_id)));

-- students: ONLY the administrator and the head of that class's department can see or change them.
-- (Teachers get read access to the classes they teach in Batch 6B.)
drop policy if exists campus_students_manage on public.campus_students;
create policy campus_students_manage on public.campus_students for all to authenticated
  using (public.can_manage_dept(public.campus_class_dept(class_id)))
  with check (public.can_manage_dept(public.campus_class_dept(class_id)));
