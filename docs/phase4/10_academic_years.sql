-- BATCH 3 — administrator-controlled active academic year.
-- ADDITIVE ONLY: creates new objects. It does not change, move or delete any existing table or data.
-- Take a backup first. Safe to run more than once.

create table if not exists public.academic_years (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  is_active  boolean not null default false,
  created_at timestamptz not null default now(),
  constraint academic_years_name_key unique (name)
);

-- at most ONE active year
create unique index if not exists academic_years_one_active on public.academic_years ((true)) where is_active;

alter table public.academic_years enable row level security;
revoke all on public.academic_years from anon;
grant select, insert, update on public.academic_years to authenticated;

drop policy if exists academic_years_read on public.academic_years;
create policy academic_years_read on public.academic_years for select to authenticated using (true);

drop policy if exists academic_years_admin_insert on public.academic_years;
create policy academic_years_admin_insert on public.academic_years for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists academic_years_admin_update on public.academic_years;
create policy academic_years_admin_update on public.academic_years for update to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- switching the active year is one atomic step and only administrators may do it
create or replace function public.set_active_academic_year(_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Only administrators can change the active academic year';
  end if;
  if not exists (select 1 from public.academic_years where id = _id) then
    raise exception 'Unknown academic year';
  end if;
  update public.academic_years set is_active = false where is_active and id <> _id;
  update public.academic_years set is_active = true where id = _id;
end $$;
revoke all on function public.set_active_academic_year(uuid) from public, anon;
grant execute on function public.set_active_academic_year(uuid) to authenticated;
