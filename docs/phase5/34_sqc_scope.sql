-- STEP 2 of 2 (run AFTER 33 has finished, and after 30 and 32): SQC representatives see only their own department.
-- Replaces one function and adds two. No table is changed, nothing is deleted.
-- Safe to run more than once.

-- Who teaches which subject in a class: read from the teachers' diaries (classes linked to the Setup class). Internal use only.
create or replace function public.sqc_class_teaching(_class uuid)
returns table (teacher_id uuid, teacher_name text, subject text, code text)
language sql stable security definer set search_path = public as $$
  select t.teacher_id, coalesce(p.name, ''), trim(c->>'subject'), coalesce(trim(c->>'code'), '')
  from public.teacher_data t
  join public.profiles p on p.id = t.teacher_id
  join public.sqc_classes q on q.id = _class and q.setup_class_id is not null
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(t.content->'classes') = 'array' then t.content->'classes' else '[]'::jsonb end) c
  where c->>'centralId' = q.setup_class_id::text
    and coalesce(c->>'closed', 'false') <> 'true'
    and trim(coalesce(c->>'subject', '')) <> '';
$$;
revoke all on function public.sqc_class_teaching(uuid) from public, anon, authenticated;

-- Subjects (and their teachers) of the classes the caller may report on.
create or replace function public.sqc_class_subjects()
returns table (class_id uuid, teacher_id uuid, teacher_name text, subject text, code text)
language plpgsql stable security definer set search_path = public as $$
declare is_admin boolean := public.has_role(auth.uid(), 'admin');
begin
  if not (is_admin or exists (select 1 from public.sqc_members m where m.user_id = auth.uid() and m.is_rep)) then
    raise exception 'Not allowed';
  end if;
  return query
    select q.id, x.teacher_id, x.teacher_name, x.subject, x.code
    from public.sqc_classes q
    cross join lateral public.sqc_class_teaching(q.id) x
    where is_admin or exists (select 1 from public.sqc_members m where m.user_id = auth.uid() and m.class_id = q.id and m.is_rep);
end $$;
revoke all on function public.sqc_class_subjects() from public, anon;
grant execute on function public.sqc_class_subjects() to authenticated;

-- Teachers a representative may choose from: only those of the department of the representative's own class
-- (same department name in the teacher's profile, department head, or teaches that class). The administrator sees everyone.
create or replace function public.sqc_teacher_list() returns table (teacher_id uuid, teacher_name text)
language plpgsql stable security definer set search_path = public as $$
declare is_admin boolean := public.has_role(auth.uid(), 'admin');
begin
  if not (is_admin or exists (select 1 from public.sqc_members m where m.user_id = auth.uid() and m.is_rep)) then
    raise exception 'Not allowed';
  end if;
  return query
    select p.id, p.name from public.profiles p
    join public.user_roles r on r.user_id = p.id
    where r.role in ('teacher', 'admin')
      and (is_admin or exists (
        select 1
        from public.sqc_members m
        join public.sqc_classes q on q.id = m.class_id
        join public.setup_classes sc on sc.id = q.setup_class_id
        join public.departments d on d.id = sc.department_id
        where m.user_id = auth.uid() and m.is_rep
          and (lower(trim(p.dept)) = lower(trim(d.name))
               or exists (select 1 from public.department_heads h where h.user_id = p.id and h.department_id = d.id)
               or exists (select 1 from public.sqc_class_teaching(q.id) tt where tt.teacher_id = p.id))))
    group by p.id, p.name
    order by p.name;
end $$;
revoke all on function public.sqc_teacher_list() from public, anon;
grant execute on function public.sqc_teacher_list() to authenticated;
