-- DEPARTMENT MANAGEMENT & SETUP HELPERS
-- 1. dm_dept_teachers: lets Department Heads and Admins list teachers of their department
-- 2. peer_class_students: lets any teacher pull students from another teacher's subject of the same class
-- Additive and safe to run more than once in Supabase SQL Editor.

create or replace function public.dm_dept_teachers(_dept uuid)
returns table (user_id uuid, name text, designation text, dept text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.dm_can_read(_dept) then
    raise exception 'Not allowed';
  end if;
  return query
    select p.id, p.name, p.designation, p.dept
    from public.profiles p
    join public.user_roles r on r.user_id = p.id
    left join public.departments d on d.id = _dept
    where r.role in ('teacher', 'admin')
      and (
        public.has_role(auth.uid(), 'admin')
        or lower(trim(p.dept)) = lower(trim(coalesce(d.name, '')))
        or exists (select 1 from public.department_heads h where h.user_id = p.id and h.department_id = _dept)
      )
    group by p.id, p.name, p.designation, p.dept
    order by p.name;
end $$;
revoke all on function public.dm_dept_teachers(uuid) from public, anon;
grant execute on function public.dm_dept_teachers(uuid) to authenticated;

create or replace function public.peer_class_students()
returns table (
  teacher_id uuid,
  teacher_name text,
  class_id text,
  central_id text,
  class_name text,
  subject text,
  code text,
  students jsonb,
  raw_students text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'teacher')) then
    raise exception 'Not allowed';
  end if;
  return query
    select
      t.teacher_id,
      coalesce(nullif(trim(p.name), ''), 'Teacher'),
      coalesce(c->>'id', ''),
      coalesce(c->>'centralId', ''),
      coalesce(c->>'name', ''),
      coalesce(c->>'subject', ''),
      coalesce(c->>'code', ''),
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object('name', trim(s->>'name'), 'roll', coalesce((s->>'roll')::int, 0))
            order by coalesce((s->>'roll')::int, 9999), s->>'name'
          )
          from jsonb_array_elements(
            case when jsonb_typeof(t.content->'students') = 'array' then t.content->'students' else '[]'::jsonb end
          ) s
          where s->>'classId' = c->>'id'
            and coalesce((s->>'active')::boolean, true) = true
            and length(trim(coalesce(s->>'name', ''))) > 0
        ),
        '[]'::jsonb
      ),
      coalesce(c->>'students', '')
    from public.teacher_data t
    left join public.profiles p on p.id = t.teacher_id
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(t.content->'classes') = 'array' then t.content->'classes' else '[]'::jsonb end
    ) c
    where coalesce((c->>'closed')::boolean, false) = false;
end $$;
revoke all on function public.peer_class_students() from public, anon;
grant execute on function public.peer_class_students() to authenticated;
