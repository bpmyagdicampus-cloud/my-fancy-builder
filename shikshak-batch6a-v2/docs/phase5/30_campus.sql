-- BATCH 6A (version 2) — Campus set-up: institution, departments, classes (e.g. BBS I, BBS II), students.
-- ADDITIVE ONLY: creates new tables and functions. Nothing existing is changed or deleted.
-- Take a backup first. Safe to run more than once. Run in the Supabase SQL editor.
-- Needs the existing has_role() function. Works whether or not the first version of this file was run.

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

create table if not exists public.setup_classes (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete restrict,
  name          text not null check (length(trim(name)) > 0),    -- e.g. BBS I, BBS II, M.Ed 1st Sem
  created_at    timestamptz not null default now(),
  constraint setup_classes_unique unique (department_id, name)
);

create table if not exists public.setup_students (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references public.setup_classes (id) on delete restrict,
  name       text not null check (length(trim(name)) > 0),
  roll       integer not null default 0,
  active     boolean not null default true,                      -- false = left / old batch (kept, never lost)
  history    jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint setup_students_unique unique (class_id, name)
);
create index if not exists setup_students_class_idx on public.setup_students (class_id);
create index if not exists setup_classes_dept_idx on public.setup_classes (department_id);

-- ---------- helper functions ----------
create or replace function public.can_manage_dept(_dept uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin')
      or exists (select 1 from public.department_heads h where h.user_id = auth.uid() and h.department_id = _dept);
$$;
create or replace function public.setup_class_dept(_class uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select department_id from public.setup_classes where id = _class;
$$;
create or replace function public.is_staff_user() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'teacher');
$$;
revoke all on function public.can_manage_dept(uuid), public.setup_class_dept(uuid), public.is_staff_user() from public, anon;
grant execute on function public.can_manage_dept(uuid), public.setup_class_dept(uuid), public.is_staff_user() to authenticated;

-- ---------- row level security ----------
alter table public.campus_profile   enable row level security;
alter table public.departments      enable row level security;
alter table public.department_heads enable row level security;
alter table public.setup_classes    enable row level security;
alter table public.setup_students   enable row level security;

revoke all on public.campus_profile, public.departments, public.department_heads, public.setup_classes, public.setup_students from anon;
grant select, insert, update, delete on public.campus_profile, public.departments, public.department_heads, public.setup_classes, public.setup_students to authenticated;

-- everything is VISIBLE to staff (admin + teachers); only the right people can CHANGE it.
drop policy if exists campus_profile_read on public.campus_profile;
create policy campus_profile_read on public.campus_profile for select to authenticated using (public.is_staff_user());
drop policy if exists campus_profile_admin on public.campus_profile;
create policy campus_profile_admin on public.campus_profile for update to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists departments_read on public.departments;
create policy departments_read on public.departments for select to authenticated using (public.is_staff_user());
drop policy if exists departments_admin on public.departments;
create policy departments_admin on public.departments for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- department heads: appointed by the administrator only; staff can see who they are
drop policy if exists department_heads_read on public.department_heads;
create policy department_heads_read on public.department_heads for select to authenticated using (public.is_staff_user());
drop policy if exists department_heads_admin on public.department_heads;
create policy department_heads_admin on public.department_heads for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- classes and students: staff read; administrator or that department's head changes
drop policy if exists setup_classes_read on public.setup_classes;
create policy setup_classes_read on public.setup_classes for select to authenticated using (public.is_staff_user());
drop policy if exists setup_classes_write on public.setup_classes;
create policy setup_classes_write on public.setup_classes for all to authenticated
  using (public.can_manage_dept(department_id)) with check (public.can_manage_dept(department_id));

drop policy if exists setup_students_read on public.setup_students;
create policy setup_students_read on public.setup_students for select to authenticated using (public.is_staff_user());
drop policy if exists setup_students_write on public.setup_students;
create policy setup_students_write on public.setup_students for all to authenticated
  using (public.can_manage_dept(public.setup_class_dept(class_id))) with check (public.can_manage_dept(public.setup_class_dept(class_id)));

-- OPTIONAL clean-up: only if you ran the FIRST version of this file and have no data in it.
-- (programs / campus_classes / campus_students are no longer used.) Remove the leading "-- " to run.
-- drop table if exists public.campus_students, public.campus_classes, public.programs;
