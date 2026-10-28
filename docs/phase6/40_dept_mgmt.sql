-- DEPARTMENT MANAGEMENT module — database (Stage 1). ADDITIVE ONLY.
-- Creates NEW tables (prefix dm_), helper functions, triggers and row-level-security policies.
-- Nothing existing is changed or deleted. Safe to run more than once.
-- Take a backup first. Run AFTER 30_campus.sql (needs departments, department_heads, can_manage_dept, is_staff_user).
-- This module is a DEPARTMENT TRACKING tool. It is not the campus's official accounting system.

-- ---------- helper functions ----------
create or replace function public.dm_can_read(_dept uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin')
      or public.can_manage_dept(_dept)
      or exists (
        select 1 from public.profiles p join public.departments d on d.id = _dept
        where p.id = auth.uid() and lower(trim(p.dept)) = lower(trim(d.name))
      );
$$;
create or replace function public.dm_plan_dept(_plan uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select department_id from public.dm_plans where id = _plan;
$$;
create or replace function public.dm_line_dept(_line uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select department_id from public.dm_budget_lines where id = _line;
$$;
revoke all on function public.dm_can_read(uuid), public.dm_plan_dept(uuid), public.dm_line_dept(uuid) from public, anon;

-- ---------- tables ----------
create table if not exists public.dm_plans (
  id               uuid primary key default gen_random_uuid(),
  department_id    uuid not null references public.departments (id) on delete restrict,
  academic_year    text not null,                                   -- for example 2083/84
  title            text not null check (length(trim(title)) > 0),
  objectives       text not null default '',
  expected_outcomes text not null default '',
  indicators       text not null default '',
  targets          text not null default '',
  estimated_budget numeric(14,2) not null default 0 check (estimated_budget >= 0),
  funding_source   text not null default '',
  start_date       text not null default '',                        -- BS date text, same as the rest of the app
  end_date         text not null default '',
  status           text not null default 'draft' check (status in ('draft','submitted','approved','rejected')),
  approval_comment text not null default '',
  approved_by      uuid references auth.users (id) on delete set null,
  approved_at      timestamptz,
  version          integer not null default 1,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  updated_at       timestamptz not null default now()
);
create index if not exists dm_plans_dept_idx on public.dm_plans (department_id, academic_year);

create table if not exists public.dm_plan_revisions (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references public.dm_plans (id) on delete cascade,
  version    integer not null,
  snapshot   jsonb not null,
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now()
);
create index if not exists dm_plan_revisions_plan_idx on public.dm_plan_revisions (plan_id);

create table if not exists public.dm_activities (
  id                 uuid primary key default gen_random_uuid(),
  department_id      uuid not null references public.departments (id) on delete restrict,
  plan_id            uuid references public.dm_plans (id) on delete set null,
  academic_year      text not null default '',
  title              text not null check (length(trim(title)) > 0),
  category           text not null default 'other',
  activity_date      text not null default '',
  deadline           text not null default '',
  responsible_user_id uuid references auth.users (id) on delete set null,
  responsible_name   text not null default '',
  participants       text not null default '',
  planned_output     text not null default '',
  actual_output      text not null default '',
  status             text not null default 'planned' check (status in ('planned','in_progress','completed','delayed','cancelled')),
  progress_pct       smallint not null default 0 check (progress_pct between 0 and 100),
  budget_amount      numeric(14,2) not null default 0 check (budget_amount >= 0),
  challenges         text not null default '',
  corrective_actions text not null default '',
  next_steps         text not null default '',
  created_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_by         uuid references auth.users (id) on delete set null,
  updated_at         timestamptz not null default now()
);
create index if not exists dm_activities_dept_idx on public.dm_activities (department_id, academic_year);
create index if not exists dm_activities_plan_idx on public.dm_activities (plan_id);

create table if not exists public.dm_budget_lines (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete restrict,
  plan_id       uuid references public.dm_plans (id) on delete restrict,
  activity_id   uuid references public.dm_activities (id) on delete set null,
  title         text not null check (length(trim(title)) > 0),
  proposed      numeric(14,2) not null default 0 check (proposed >= 0),
  approved      numeric(14,2) not null default 0 check (approved >= 0),
  status        text not null default 'draft' check (status in ('draft','submitted','approved','rejected')),
  comment       text not null default '',
  approved_by   uuid references auth.users (id) on delete set null,
  approved_at   timestamptz,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_by    uuid references auth.users (id) on delete set null,
  updated_at    timestamptz not null default now()
);
create index if not exists dm_budget_lines_dept_idx on public.dm_budget_lines (department_id);

create table if not exists public.dm_budget_revisions (
  id               uuid primary key default gen_random_uuid(),
  line_id          uuid not null references public.dm_budget_lines (id) on delete cascade,
  requested_amount numeric(14,2) not null check (requested_amount >= 0),
  reason           text not null default '',
  status           text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_by     uuid references auth.users (id) on delete set null default auth.uid(),
  requested_at     timestamptz not null default now(),
  decided_by       uuid references auth.users (id) on delete set null,
  decided_at       timestamptz,
  decision_comment text not null default ''
);
create index if not exists dm_budget_revisions_line_idx on public.dm_budget_revisions (line_id);

create table if not exists public.dm_expenses (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete restrict,
  line_id       uuid references public.dm_budget_lines (id) on delete restrict,
  plan_id       uuid references public.dm_plans (id) on delete restrict,
  activity_id   uuid references public.dm_activities (id) on delete set null,
  expense_date  text not null default '',
  description   text not null default '',
  amount        numeric(14,2) not null check (amount <> 0),          -- a correction is a NEW negative entry
  voucher_no    text not null default '',
  reversal_of   uuid references public.dm_expenses (id) on delete restrict,
  locked        boolean not null default false,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_by    uuid references auth.users (id) on delete set null,
  updated_at    timestamptz not null default now()
);
create index if not exists dm_expenses_dept_idx on public.dm_expenses (department_id);
create index if not exists dm_expenses_line_idx on public.dm_expenses (line_id);

create table if not exists public.dm_evidence (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete restrict,
  activity_id   uuid references public.dm_activities (id) on delete cascade,
  expense_id    uuid references public.dm_expenses (id) on delete cascade,
  file_path     text not null,                                       -- <department id>/<file>  in the dept-evidence bucket
  file_name     text not null default '',
  mime          text not null default '',
  size_bytes    integer not null default 0,
  uploaded_by   uuid references auth.users (id) on delete set null default auth.uid(),
  uploaded_at   timestamptz not null default now()
);
create index if not exists dm_evidence_dept_idx on public.dm_evidence (department_id);

-- ---------- triggers ----------
create or replace function public.dm_touch() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
    new.created_at := coalesce(new.created_at, now());
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end $$;

-- plans: only the administration approves / rejects; an approved plan is locked for others; every change keeps the old version
create or replace function public.dm_plans_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare adm boolean := public.has_role(auth.uid(), 'admin');
begin
  if tg_op = 'INSERT' then
    if not adm then new.status := 'draft'; new.approved_by := null; new.approved_at := null; end if;
  else
    if not adm then
      if old.status = 'approved' then raise exception 'An approved plan can be changed only by the administration.'; end if;
      if new.status in ('approved', 'rejected') then raise exception 'Only the administration can approve or reject a plan.'; end if;
    end if;
    if new.status in ('approved', 'rejected') and new.status is distinct from old.status then
      new.approved_by := auth.uid(); new.approved_at := now();
    end if;
    new.version := old.version + 1;
  end if;
  return new;
end $$;
create or replace function public.dm_plan_snapshot() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.dm_plan_revisions (plan_id, version, snapshot, changed_by) values (old.id, old.version, to_jsonb(old), auth.uid());
  return new;
end $$;
drop trigger if exists dm_plans_1_guard on public.dm_plans;
create trigger dm_plans_1_guard before insert or update on public.dm_plans for each row execute function public.dm_plans_guard();
drop trigger if exists dm_plans_2_snapshot on public.dm_plans;
create trigger dm_plans_2_snapshot before update on public.dm_plans for each row execute function public.dm_plan_snapshot();
drop trigger if exists dm_plans_3_touch on public.dm_plans;
create trigger dm_plans_3_touch before insert or update on public.dm_plans for each row execute function public.dm_touch();

-- activities: a teacher who is only "responsible" can change the progress fields, nothing else
create or replace function public.dm_activities_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and not public.can_manage_dept(old.department_id) then
    if new.department_id is distinct from old.department_id or new.plan_id is distinct from old.plan_id
       or new.title is distinct from old.title or new.category is distinct from old.category
       or new.activity_date is distinct from old.activity_date or new.deadline is distinct from old.deadline
       or new.responsible_user_id is distinct from old.responsible_user_id or new.responsible_name is distinct from old.responsible_name
       or new.budget_amount is distinct from old.budget_amount or new.academic_year is distinct from old.academic_year
       or new.planned_output is distinct from old.planned_output or new.participants is distinct from old.participants then
      raise exception 'You can update only the progress of an activity assigned to you.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists dm_activities_1_guard on public.dm_activities;
create trigger dm_activities_1_guard before update on public.dm_activities for each row execute function public.dm_activities_guard();
drop trigger if exists dm_activities_2_touch on public.dm_activities;
create trigger dm_activities_2_touch before insert or update on public.dm_activities for each row execute function public.dm_touch();

-- budget lines: only the administration sets the approved amount / approves; approved lines change only through a revision request
create or replace function public.dm_lines_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare adm boolean := public.has_role(auth.uid(), 'admin');
begin
  if tg_op = 'INSERT' then
    if not adm then
      new.approved := 0; new.approved_by := null; new.approved_at := null;
      if new.status not in ('draft', 'submitted') then new.status := 'draft'; end if;
    end if;
  else
    if not adm then
      if old.status = 'approved' then raise exception 'An approved budget line is locked. Send a revision request instead.'; end if;
      if new.approved is distinct from old.approved or new.status in ('approved', 'rejected') then
        raise exception 'Only the administration can approve a budget or set the approved amount.';
      end if;
    end if;
  end if;
  if adm and new.status in ('approved', 'rejected') and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    new.approved_by := auth.uid(); new.approved_at := now();
    if new.status = 'approved' and new.approved = 0 then new.approved := new.proposed; end if;
  end if;
  return new;
end $$;
drop trigger if exists dm_lines_1_guard on public.dm_budget_lines;
create trigger dm_lines_1_guard before insert or update on public.dm_budget_lines for each row execute function public.dm_lines_guard();
drop trigger if exists dm_lines_2_touch on public.dm_budget_lines;
create trigger dm_lines_2_touch before insert or update on public.dm_budget_lines for each row execute function public.dm_touch();

drop trigger if exists dm_expenses_touch on public.dm_expenses;
create trigger dm_expenses_touch before insert or update on public.dm_expenses for each row execute function public.dm_touch();

-- the administration decides a budget revision request (one atomic step)
create or replace function public.dm_budget_decide_revision(_id uuid, _approve boolean, _comment text default '')
returns void language plpgsql security definer set search_path = public as $$
declare r public.dm_budget_revisions;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Only the administration can decide a budget revision.'; end if;
  select * into r from public.dm_budget_revisions where id = _id for update;
  if r.id is null then raise exception 'Revision request not found.'; end if;
  if r.status <> 'pending' then raise exception 'This request was already decided.'; end if;
  update public.dm_budget_revisions
     set status = case when _approve then 'approved' else 'rejected' end, decided_by = auth.uid(), decided_at = now(), decision_comment = coalesce(_comment, '')
   where id = _id;
  if _approve then update public.dm_budget_lines set approved = r.requested_amount where id = r.line_id; end if;
end $$;
revoke all on function public.dm_budget_decide_revision(uuid, boolean, text) from public, anon;
grant execute on function public.dm_budget_decide_revision(uuid, boolean, text) to authenticated;

-- ---------- row level security ----------
alter table public.dm_plans            enable row level security;
alter table public.dm_plan_revisions   enable row level security;
alter table public.dm_activities       enable row level security;
alter table public.dm_budget_lines     enable row level security;
alter table public.dm_budget_revisions enable row level security;
alter table public.dm_expenses         enable row level security;
alter table public.dm_evidence         enable row level security;
revoke all on public.dm_plans, public.dm_plan_revisions, public.dm_activities, public.dm_budget_lines, public.dm_budget_revisions, public.dm_expenses, public.dm_evidence from anon;
grant select, insert, update, delete on public.dm_plans, public.dm_activities, public.dm_budget_lines, public.dm_budget_revisions, public.dm_expenses, public.dm_evidence to authenticated;
grant select on public.dm_plan_revisions to authenticated;

-- plans: people of the department read; head / administration write; only DRAFT plans can be deleted (history is kept)
drop policy if exists dm_plans_read on public.dm_plans;
create policy dm_plans_read on public.dm_plans for select to authenticated using (public.dm_can_read(department_id));
drop policy if exists dm_plans_insert on public.dm_plans;
create policy dm_plans_insert on public.dm_plans for insert to authenticated with check (public.can_manage_dept(department_id));
drop policy if exists dm_plans_update on public.dm_plans;
create policy dm_plans_update on public.dm_plans for update to authenticated using (public.can_manage_dept(department_id)) with check (public.can_manage_dept(department_id));
drop policy if exists dm_plans_delete on public.dm_plans;
create policy dm_plans_delete on public.dm_plans for delete to authenticated using (public.can_manage_dept(department_id) and status = 'draft');

drop policy if exists dm_plan_revisions_read on public.dm_plan_revisions;
create policy dm_plan_revisions_read on public.dm_plan_revisions for select to authenticated using (public.dm_can_read(public.dm_plan_dept(plan_id)));

-- activities: department people read; head / administration write; the responsible person updates progress (see trigger)
drop policy if exists dm_activities_read on public.dm_activities;
create policy dm_activities_read on public.dm_activities for select to authenticated using (public.dm_can_read(department_id) or responsible_user_id = auth.uid());
drop policy if exists dm_activities_insert on public.dm_activities;
create policy dm_activities_insert on public.dm_activities for insert to authenticated with check (public.can_manage_dept(department_id));
drop policy if exists dm_activities_update on public.dm_activities;
create policy dm_activities_update on public.dm_activities for update to authenticated
  using (public.can_manage_dept(department_id) or responsible_user_id = auth.uid())
  with check (public.can_manage_dept(department_id) or responsible_user_id = auth.uid());
drop policy if exists dm_activities_delete on public.dm_activities;
create policy dm_activities_delete on public.dm_activities for delete to authenticated using (public.can_manage_dept(department_id));

-- budget and expenses are money: only the head of the department and the administration see and change them
drop policy if exists dm_lines_read on public.dm_budget_lines;
create policy dm_lines_read on public.dm_budget_lines for select to authenticated using (public.can_manage_dept(department_id));
drop policy if exists dm_lines_insert on public.dm_budget_lines;
create policy dm_lines_insert on public.dm_budget_lines for insert to authenticated with check (public.can_manage_dept(department_id));
drop policy if exists dm_lines_update on public.dm_budget_lines;
create policy dm_lines_update on public.dm_budget_lines for update to authenticated using (public.can_manage_dept(department_id)) with check (public.can_manage_dept(department_id));
drop policy if exists dm_lines_delete on public.dm_budget_lines;
create policy dm_lines_delete on public.dm_budget_lines for delete to authenticated using (public.can_manage_dept(department_id) and status = 'draft');

drop policy if exists dm_revisions_read on public.dm_budget_revisions;
create policy dm_revisions_read on public.dm_budget_revisions for select to authenticated using (public.can_manage_dept(public.dm_line_dept(line_id)));
drop policy if exists dm_revisions_insert on public.dm_budget_revisions;
create policy dm_revisions_insert on public.dm_budget_revisions for insert to authenticated
  with check (public.can_manage_dept(public.dm_line_dept(line_id)) and status = 'pending');
-- decisions are made only through dm_budget_decide_revision() (administration)

drop policy if exists dm_expenses_read on public.dm_expenses;
create policy dm_expenses_read on public.dm_expenses for select to authenticated using (public.can_manage_dept(department_id));
drop policy if exists dm_expenses_insert on public.dm_expenses;
create policy dm_expenses_insert on public.dm_expenses for insert to authenticated with check (public.can_manage_dept(department_id));
drop policy if exists dm_expenses_update on public.dm_expenses;
create policy dm_expenses_update on public.dm_expenses for update to authenticated
  using (public.has_role(auth.uid(), 'admin') or (public.can_manage_dept(department_id) and not locked))
  with check (public.has_role(auth.uid(), 'admin') or public.can_manage_dept(department_id));
drop policy if exists dm_expenses_delete on public.dm_expenses;
create policy dm_expenses_delete on public.dm_expenses for delete to authenticated using (public.has_role(auth.uid(), 'admin') and not locked);

-- evidence: department people see evidence of activities; money evidence only head / administration
drop policy if exists dm_evidence_read on public.dm_evidence;
create policy dm_evidence_read on public.dm_evidence for select to authenticated
  using (public.can_manage_dept(department_id) or (activity_id is not null and public.dm_can_read(department_id)));
drop policy if exists dm_evidence_insert on public.dm_evidence;
create policy dm_evidence_insert on public.dm_evidence for insert to authenticated
  with check (public.can_manage_dept(department_id)
    or exists (select 1 from public.dm_activities a where a.id = activity_id and a.responsible_user_id = auth.uid()));
drop policy if exists dm_evidence_delete on public.dm_evidence;
create policy dm_evidence_delete on public.dm_evidence for delete to authenticated using (public.can_manage_dept(department_id));
