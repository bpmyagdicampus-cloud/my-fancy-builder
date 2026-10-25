-- BATCH 6B — One class system: SQC uses the classes created in Setup.
-- ADDITIVE ONLY: adds one column and one function, and adds missing rows. NOTHING is deleted.
-- Existing SQC classes keep their id, so all SQC reports, members and history stay connected.
-- Take a backup first. Safe to run more than once. Run AFTER 30_campus.sql.

-- 1. make sure the Management department exists
insert into public.departments (name)
select 'Management' where not exists (select 1 from public.departments where lower(name) = 'management');

-- 2. SQC class -> Setup class link
alter table public.sqc_classes add column if not exists setup_class_id uuid references public.setup_classes (id) on delete set null;
create index if not exists sqc_classes_setup_idx on public.sqc_classes (setup_class_id);

-- 3. sync function (called by the app when SQC opens, and by the "Refresh from Setup" button)
create or replace function public.sqc_sync_classes() returns integer
language plpgsql security definer set search_path = public as $$
declare
  mg uuid; n integer := 0; r record; sid uuid;
begin
  if not public.is_staff_user() then raise exception 'not allowed'; end if;
  select id into mg from public.departments where lower(name) = 'management' order by created_at limit 1;

  -- (a) older SQC classes with no link: link to the Setup class of the same name; if none, add it to Management
  for r in
    select id, trim(name || case when coalesce(section, '') <> '' then ' ' || section else '' end) as full_name
    from public.sqc_classes where setup_class_id is null
  loop
    sid := null;
    select id into sid from public.setup_classes where lower(name) = lower(r.full_name) order by (department_id = mg) desc limit 1;
    if sid is null and mg is not null then
      insert into public.setup_classes (department_id, name) values (mg, r.full_name) on conflict (department_id, name) do nothing;
      select id into sid from public.setup_classes where department_id = mg and name = r.full_name;
    end if;
    if sid is not null then
      update public.sqc_classes set setup_class_id = sid where id = r.id;
      n := n + 1;
    end if;
  end loop;

  -- (b) Setup classes that SQC does not have yet: create the SQC class
  for r in
    select sc.id, sc.name from public.setup_classes sc
    where not exists (select 1 from public.sqc_classes q where q.setup_class_id = sc.id)
  loop
    update public.sqc_classes set setup_class_id = r.id where name = r.name and section = '' and setup_class_id is null;
    if not found then
      insert into public.sqc_classes (name, section, setup_class_id) values (r.name, '', r.id) on conflict (name, section) do nothing;
    end if;
    n := n + 1;
  end loop;

  -- (c) a class renamed in Setup is renamed in SQC too (only when it causes no name clash)
  update public.sqc_classes q set name = sc.name, section = ''
  from public.setup_classes sc
  where q.setup_class_id = sc.id and (q.name <> sc.name or q.section <> '')
    and not exists (select 1 from public.sqc_classes z where z.name = sc.name and z.section = '' and z.id <> q.id);

  return n;
end $$;
revoke all on function public.sqc_sync_classes() from public, anon;
grant execute on function public.sqc_sync_classes() to authenticated;

-- 4. quick check (read only): every SQC class should now show its Setup class
-- select q.name, q.section, sc.name as setup_class, d.name as department
-- from public.sqc_classes q left join public.setup_classes sc on sc.id = q.setup_class_id left join public.departments d on d.id = sc.department_id;
