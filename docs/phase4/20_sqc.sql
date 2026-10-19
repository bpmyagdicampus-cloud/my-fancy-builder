-- BATCH 4 — SQC (Student Quality Control).
-- ADDITIVE ONLY: creates new tables/functions. Nothing existing is changed or deleted.
-- Run 10_academic_years.sql FIRST. Take a backup first. Safe to run more than once.

do $$ begin
  if to_regclass('public.academic_years') is null then
    raise exception 'Run 10_academic_years.sql first';
  end if;
end $$;

-- ---------- tables ----------
create table if not exists public.sqc_classes (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  section    text not null default '',
  created_at timestamptz not null default now(),
  constraint sqc_classes_unique unique (name, section)
);

create table if not exists public.sqc_members (
  user_id    uuid not null references auth.users (id) on delete cascade,
  class_id   uuid not null references public.sqc_classes (id) on delete cascade,
  is_rep     boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, class_id)
);
create index if not exists sqc_members_class_idx on public.sqc_members (class_id);

create table if not exists public.sqc_periods (
  period_no  smallint primary key check (period_no between 1 and 12),
  start_time time not null,
  end_time   time not null
);

create table if not exists public.sqc_reports (
  id                uuid primary key default gen_random_uuid(),
  class_id          uuid not null references public.sqc_classes (id) on delete restrict,
  report_date       text not null check (report_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),   -- BS date, e.g. 2083-05-04
  period_no         smallint not null check (period_no between 1 and 12),
  teacher_id        uuid references auth.users (id) on delete set null,
  teacher_name      text not null default '',
  subject           text not null default '',
  held              boolean not null,
  arrival_time      time,
  departure_time    time,
  not_held_reason   text not null default '',
  present_count     integer check (present_count >= 0),
  total_count       integer check (total_count >= 0),
  issues            text not null default '',
  facilities        text not null default '',
  requests          text not null default '',
  suggestions       text not null default '',
  status            text not null default 'Submitted' check (status in ('Submitted', 'Under Review', 'In Progress', 'Resolved')),
  submitted_by      uuid references auth.users (id) on delete set null default auth.uid(),
  submitted_by_name text not null default '',
  submitted_at      timestamptz not null default now(),
  year_name         text not null default '',
  updated_at        timestamptz not null default now(),
  constraint sqc_reports_one_per_period unique (class_id, report_date, period_no),
  constraint sqc_reports_held_rule check ((held and arrival_time is not null) or (not held and length(trim(not_held_reason)) > 0)),
  constraint sqc_reports_count_rule check (present_count is null or total_count is null or present_count <= total_count)
);
create index if not exists sqc_reports_class_date_idx on public.sqc_reports (class_id, report_date);
create index if not exists sqc_reports_teacher_idx    on public.sqc_reports (teacher_id);
create index if not exists sqc_reports_status_idx     on public.sqc_reports (status);

create table if not exists public.sqc_actions (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid not null references public.sqc_reports (id) on delete cascade,
  response     text not null default '',
  responsible  text not null default '',
  action_taken text not null default '',
  resolved_on  text check (resolved_on is null or resolved_on ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  status       text not null check (status in ('Submitted', 'Under Review', 'In Progress', 'Resolved')),
  created_by   uuid references auth.users (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists sqc_actions_report_idx on public.sqc_actions (report_id);

-- ---------- helper functions ----------
create or replace function public.sqc_is_member(_class uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.sqc_members where user_id = auth.uid() and class_id = _class);
$$;
create or replace function public.sqc_is_rep(_class uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.sqc_members where user_id = auth.uid() and class_id = _class and is_rep);
$$;
revoke all on function public.sqc_is_member(uuid), public.sqc_is_rep(uuid) from public, anon;
grant execute on function public.sqc_is_member(uuid), public.sqc_is_rep(uuid) to authenticated;

-- list of teachers a representative may choose from (names only)
create or replace function public.sqc_teacher_list() returns table (teacher_id uuid, teacher_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.has_role(auth.uid(), 'admin')
          or exists (select 1 from public.sqc_members m where m.user_id = auth.uid() and m.is_rep)) then
    raise exception 'Not allowed';
  end if;
  return query
    select p.id, p.name from public.profiles p
    join public.user_roles r on r.user_id = p.id
    where r.role in ('teacher', 'admin')
    group by p.id, p.name
    order by p.name;
end $$;
revoke all on function public.sqc_teacher_list() from public, anon;
grant execute on function public.sqc_teacher_list() to authenticated;

-- ---------- guards: representatives cannot change who/what/status ----------
create or replace function public.sqc_reports_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare is_admin boolean := public.has_role(auth.uid(), 'admin');
begin
  if tg_op = 'INSERT' then
    new.submitted_by      := auth.uid();
    new.submitted_by_name := coalesce((select name from public.profiles where id = auth.uid()), '');
    new.submitted_at      := now();
    new.year_name         := coalesce((select name from public.academic_years where is_active limit 1), '');
    if not is_admin then new.status := 'Submitted'; end if;
    if new.teacher_id is not null and coalesce(new.teacher_name, '') = '' then
      new.teacher_name := coalesce((select name from public.profiles where id = new.teacher_id), '');
    end if;
  else
    if not is_admin then
      if new.class_id <> old.class_id or new.status <> old.status
         or new.submitted_by is distinct from old.submitted_by
         or new.submitted_at <> old.submitted_at or new.year_name <> old.year_name then
        raise exception 'You cannot change the class, status or submission details of a report';
      end if;
    end if;
    new.updated_at := now();
  end if;
  return new;
end $$;
drop trigger if exists sqc_reports_guard_trg on public.sqc_reports;
create trigger sqc_reports_guard_trg before insert or update on public.sqc_reports
  for each row execute function public.sqc_reports_guard();

-- an administrator's response also moves the report's status
create or replace function public.sqc_actions_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.sqc_reports set status = new.status, updated_at = now() where id = new.report_id;
  return new;
end $$;
drop trigger if exists sqc_actions_sync_trg on public.sqc_actions;
create trigger sqc_actions_sync_trg after insert on public.sqc_actions
  for each row execute function public.sqc_actions_sync();

-- ---------- row level security ----------
alter table public.sqc_classes enable row level security;
alter table public.sqc_members enable row level security;
alter table public.sqc_periods enable row level security;
alter table public.sqc_reports enable row level security;
alter table public.sqc_actions enable row level security;

revoke all on public.sqc_classes, public.sqc_members, public.sqc_periods, public.sqc_reports, public.sqc_actions from anon;
grant select, insert, update, delete on public.sqc_classes, public.sqc_members, public.sqc_periods, public.sqc_reports, public.sqc_actions to authenticated;

-- classes: admin; members of the class; teachers named in a report of that class
drop policy if exists sqc_classes_read on public.sqc_classes;
create policy sqc_classes_read on public.sqc_classes for select to authenticated using (
  public.has_role(auth.uid(), 'admin') or public.sqc_is_member(id)
  or exists (select 1 from public.sqc_reports r where r.class_id = sqc_classes.id and r.teacher_id = auth.uid())
);
drop policy if exists sqc_classes_admin on public.sqc_classes;
create policy sqc_classes_admin on public.sqc_classes for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- members: you see only your own membership; only admin changes them
drop policy if exists sqc_members_read on public.sqc_members;
create policy sqc_members_read on public.sqc_members for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
drop policy if exists sqc_members_admin on public.sqc_members;
create policy sqc_members_admin on public.sqc_members for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- period times: everybody signed in may read; only admin changes
drop policy if exists sqc_periods_read on public.sqc_periods;
create policy sqc_periods_read on public.sqc_periods for select to authenticated using (true);
drop policy if exists sqc_periods_admin on public.sqc_periods;
create policy sqc_periods_admin on public.sqc_periods for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- reports: admin all; a representative only for the class they represent; a teacher only reports that name them
drop policy if exists sqc_reports_read on public.sqc_reports;
create policy sqc_reports_read on public.sqc_reports for select to authenticated using (
  public.has_role(auth.uid(), 'admin') or public.sqc_is_rep(class_id) or teacher_id = auth.uid()
);
drop policy if exists sqc_reports_insert on public.sqc_reports;
create policy sqc_reports_insert on public.sqc_reports for insert to authenticated with check (
  public.has_role(auth.uid(), 'admin') or (public.sqc_is_rep(class_id) and status = 'Submitted')
);
drop policy if exists sqc_reports_update on public.sqc_reports;
create policy sqc_reports_update on public.sqc_reports for update to authenticated using (
  public.has_role(auth.uid(), 'admin') or (public.sqc_is_rep(class_id) and submitted_by = auth.uid() and status = 'Submitted')
) with check (
  public.has_role(auth.uid(), 'admin') or (public.sqc_is_rep(class_id) and submitted_by = auth.uid() and status = 'Submitted')
);
drop policy if exists sqc_reports_delete on public.sqc_reports;
create policy sqc_reports_delete on public.sqc_reports for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- actions: readable wherever the report is readable; only admin writes
drop policy if exists sqc_actions_read on public.sqc_actions;
create policy sqc_actions_read on public.sqc_actions for select to authenticated using (
  public.has_role(auth.uid(), 'admin') or exists (select 1 from public.sqc_reports r where r.id = sqc_actions.report_id)
);
drop policy if exists sqc_actions_admin on public.sqc_actions;
create policy sqc_actions_admin on public.sqc_actions for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
