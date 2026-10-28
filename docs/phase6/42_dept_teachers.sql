-- DEPARTMENT MANAGEMENT — helper RPC so Department Heads and Admins can pick teachers in their department.
-- Run AFTER 40_dept_mgmt.sql. Additive and safe to run more than once.
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
