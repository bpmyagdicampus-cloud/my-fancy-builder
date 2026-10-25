-- SQC (Student Quality Control) on the CENTRAL class list (public.setup_classes, managed in Setup -> Classes).
-- REPLACES docs/phase4/20_sqc.sql and docs/phase5/32_class_link.sql — do NOT run those two.
--
-- Works in BOTH situations, nothing is assumed:
--   * fresh database: creates the SQC tables with class_id -> setup_classes(id)
--   * an older SQC was installed (sqc_classes exists): every SQC class is matched to a Setup class
--     (by its link, else by name, else it is created in the Management department), and all SQC
--     reports and members are re-pointed to that Setup class. No report, action or member is deleted.
--     sqc_classes itself is kept (marked deprecated) as a record of the old ids.
-- Non-SQC data (profiles, roles, diaries, departments, classes, students, years) is never changed,
-- except that a missing 'Management' department / missing Setup classes may be ADDED.
-- Requires (run before): phase2/01, phase2/02, phase4/10_academic_years.sql, phase5/30_campus.sql.
-- Runs as one transaction; if anything fails nothing is changed. Safe to run more than once.

begin;

do $$ begin
  if to_regprocedure('public.has_role(uuid, public.app_role)') is null then raise exception 'Run docs/phase2 (01, 02) first'; end if;
  if to_regclass('public.academic_years') is null then raise exception 'Run docs/phase4/10_academic_years.sql first'; end if;
  if to_regclass('public.setup_classes') is null or to_regprocedure('public.is_staff_user()') is null then
    raise exception 'Run docs/phase5/30_campus.sql first';
  end if;
end $$;

-- ---------- 1. tables (class_id points at the central Setup classes) ----------
create table if not exists public.sqc_members (
  user_id    uuid not null references auth.users (id) on delete cascade,
  class_id   uuid not null,
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
  class_id          uuid not null,
  report_date       text not null check (report_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
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

-- ---------- 2. move an older SQC (sqc_classes) onto the Setup classes ----------
do $$
declare
  mg uuid; r record; sid uuid; c record; clash int;
  has_link boolean;
begin
  if to_regclass('public.sqc_classes') is null then return; end if;

  -- remove foreign keys that point at sqc_classes (the data stays)
  for c in select conrelid::regclass as tbl, conname from pg_constraint
           where contype = 'f' and confrelid = 'public.sqc_classes'::regclass loop
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
  end loop;

  insert into public.departments (name)
  select 'Management' where not exists (select 1 from public.departments where lower(name) = 'management');
  select id into mg from public.departments where lower(name) = 'management' order by created_at limit 1;

  has_link := exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = 'sqc_classes' and column_name = 'setup_class_id');

  create temp table sqc_class_map (old_id uuid primary key, new_id uuid not null) on commit drop;

  for r in select q.id, trim(q.name || case when coalesce(q.section, '') <> '' then ' ' || q.section else '' end) as full_name
           from public.sqc_classes q loop
    sid := null;
    if has_link then
      execute 'select s.id from public.sqc_classes q join public.setup_classes s on s.id = q.setup_class_id where q.id = $1'
        into sid using r.id;
    end if;
    if sid is null then
      select id into sid from public.setup_classes where lower(name) = lower(r.full_name)
      order by (department_id = mg) desc, created_at limit 1;
    end if;
    if sid is null then
      insert into public.setup_classes (department_id, name) values (mg, r.full_name)
      on conflict (department_id, name) do nothing;
      select id into sid from public.setup_classes where department_id = mg and name = r.full_name;
    end if;
    insert into sqc_class_map values (r.id, sid);
  end loop;

  -- two old classes merged into one Setup class must not create two reports for the same period
  select count(*) into clash from (
    select coalesce(m.new_id, x.class_id), x.report_date, x.period_no from public.sqc_reports x
    left join sqc_class_map m on m.old_id = x.class_id
    group by 1, 2, 3 having count(*) > 1) t;
  if clash > 0 then
    raise exception 'Stopped, nothing changed: % report slot(s) would be duplicated because two SQC classes match one Setup class. Rename one class in Setup so the names differ, then run again.', clash;
  end if;

  update public.sqc_reports x set class_id = m.new_id from sqc_class_map m where x.class_id = m.old_id;

  -- memberships: merge (keep representative if either was)
  insert into public.sqc_members (user_id, class_id, is_rep, created_at)
  select x.user_id, m.new_id, bool_or(x.is_rep), min(x.created_at)
  from public.sqc_members x join sqc_class_map m on m.old_id = x.class_id
  where m.new_id <> x.class_id
  group by x.user_id, m.new_id
  on conflict (user_id, class_id) do update set is_rep = public.sqc_members.is_rep or excluded.is_rep;
  delete from public.sqc_members x using sqc_class_map m where x.class_id = m.old_id and m.new_id <> m.old_id;

  comment on table public.sqc_classes is 'DEPRECATED: SQC now uses public.setup_classes. Kept only as a record of old class ids.';
end $$;

drop function if exists public.sqc_sync_classes();

-- ---------- 3. foreign keys to the central class list ----------
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sqc_reports_class_fk') then
    alter table public.sqc_reports add constraint sqc_reports_class_fk
      foreign key (class_id) references public.setup_classes (id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sqc_members_class_fk') then
    alter table public.sqc_members add constraint sqc_members_class_fk
      foreign key (class_id) references public.setup_classes (id) on delete cascade;
  end if;
end $$;

-- ---------- 4. helper functions ----------
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

create or replace function public.sqc_actions_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.sqc_reports set status = new.status, updated_at = now() where id = new.report_id;
  return new;
end $$;
drop trigger if exists sqc_actions_sync_trg on public.sqc_actions;
create trigger sqc_actions_sync_trg after insert on public.sqc_actions
  for each row execute function public.sqc_actions_sync();

-- ---------- 5. access rules ----------
alter table public.sqc_members enable row level security;
alter table public.sqc_periods enable row level security;
alter table public.sqc_reports enable row level security;
alter table public.sqc_actions enable row level security;

revoke all on public.sqc_members, public.sqc_periods, public.sqc_reports, public.sqc_actions from anon;
grant select, insert, update, delete on public.sqc_members, public.sqc_periods, public.sqc_reports, public.sqc_actions to authenticated;
grant all on public.sqc_members, public.sqc_periods, public.sqc_reports, public.sqc_actions to service_role;

-- class names come from setup_classes, which every staff member may already read (30_campus.sql)

drop policy if exists sqc_members_read on public.sqc_members;
create policy sqc_members_read on public.sqc_members for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
drop policy if exists sqc_members_admin on public.sqc_members;
create policy sqc_members_admin on public.sqc_members for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists sqc_periods_read on public.sqc_periods;
create policy sqc_periods_read on public.sqc_periods for select to authenticated using (true);
drop policy if exists sqc_periods_admin on public.sqc_periods;
create policy sqc_periods_admin on public.sqc_periods for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

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

drop policy if exists sqc_actions_read on public.sqc_actions;
create policy sqc_actions_read on public.sqc_actions for select to authenticated using (
  public.has_role(auth.uid(), 'admin') or exists (select 1 from public.sqc_reports r where r.id = sqc_actions.report_id)
);
drop policy if exists sqc_actions_admin on public.sqc_actions;
create policy sqc_actions_admin on public.sqc_actions for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

commit;

-- check (read only): every report's class should show a Setup class and department
-- select d.name as department, s.name as class, count(*) from public.sqc_reports x
-- join public.setup_classes s on s.id = x.class_id join public.departments d on d.id = s.department_id group by 1, 2;
