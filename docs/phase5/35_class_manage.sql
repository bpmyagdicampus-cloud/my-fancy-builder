-- Safe delete of a class that was created by mistake (Setup -> Classes -> "Delete this class").
-- ADDS one function. Nothing is changed or deleted by running this file. Safe to run more than once.
-- The function refuses to delete a class that is in use anywhere; only an unused class is removed.
create or replace function public.setup_class_delete(_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare dept uuid;
begin
  select department_id into dept from public.setup_classes where id = _id;
  if dept is null then raise exception 'This class no longer exists.'; end if;
  if not public.can_manage_dept(dept) then
    raise exception 'Only the administrator or the head of this department can delete a class.';
  end if;

  -- used by a teacher (current classes or earlier years)
  if exists (
    select 1 from public.teacher_data t
    cross join lateral jsonb_array_elements(case when jsonb_typeof(t.content->'classes') = 'array' then t.content->'classes' else '[]'::jsonb end) c
    where c->>'centralId' = _id::text
  ) or exists (
    select 1 from public.teacher_data t
    cross join lateral jsonb_each(case when jsonb_typeof(t.content->'archive') = 'object' then t.content->'archive' else '{}'::jsonb end) y
    cross join lateral jsonb_array_elements(case when jsonb_typeof(y.value->'classes') = 'array' then y.value->'classes' else '[]'::jsonb end) c
    where c->>'centralId' = _id::text
  ) then
    raise exception 'A teacher already uses this class (in the Classes list of their diary). Change or delete that teacher''s class first, then delete this one.';
  end if;

  -- old campus student list
  if exists (select 1 from public.setup_students where class_id = _id) then
    raise exception 'This class still has students in the campus list, so it cannot be deleted.';
  end if;

  -- SQC: students or reports
  if exists (
    select 1 from public.sqc_classes q
    where q.setup_class_id = _id
      and (exists (select 1 from public.sqc_members m where m.class_id = q.id)
        or exists (select 1 from public.sqc_reports r where r.class_id = q.id))
  ) then
    raise exception 'SQC already has students or reports in this class, so it cannot be deleted.';
  end if;

  delete from public.sqc_classes where setup_class_id = _id;   -- the empty SQC copy
  delete from public.setup_classes where id = _id;
  return 'deleted';
end $$;
revoke all on function public.setup_class_delete(uuid) from public, anon;
grant execute on function public.setup_class_delete(uuid) to authenticated;
