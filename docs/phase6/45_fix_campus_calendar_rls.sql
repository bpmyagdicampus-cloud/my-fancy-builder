-- BATCH 8: FIX CAMPUS ANNUAL CALENDAR RLS & UNIVERSAL RPC
-- Makes Campus Annual Calendar visible to ALL users (teachers, staff, students, anonymous)
-- Safe to run multiple times in Lovable / Supabase SQL Editor.

-- 1. Ensure tables exist
create table if not exists public.campus_cal_types (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  color      text not null default 'blue',
  is_holiday boolean not null default false,
  created_at timestamptz not null default now(),
  constraint campus_cal_types_name_unique unique (name)
);

create table if not exists public.campus_annual_calendar (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(trim(title)) > 0),
  event_type  text not null default 'Event',
  from_date   text not null check (from_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  to_date     text check (to_date is null or to_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  description text not null default '',
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2. Populate default event types if empty
insert into public.campus_cal_types (name, color, is_holiday) values
  ('Regular classes', 'slate', false),
  ('First-Term Examination', 'amber', false),
  ('Second-Term Examination', 'amber', false),
  ('Third-Term Examination', 'amber', false),
  ('Final / Board Exam', 'rose', false),
  ('Dashain–Tihar holiday', 'red', true),
  ('Winter holiday', 'sky', true),
  ('Summer holiday', 'orange', true),
  ('Public holiday', 'red', true),
  ('Course Orientation', 'blue', false),
  ('Result & Prize Distribution', 'emerald', false),
  ('Remedial Classes', 'purple', false),
  ('Guest Lecture', 'teal', false),
  ('Event / Activity', 'blue', false)
on conflict (name) do nothing;

-- 3. Grants: Allow EVERYONE (anon and authenticated) to read calendar and types
grant select on public.campus_cal_types to anon, authenticated;
grant select on public.campus_annual_calendar to anon, authenticated;
grant insert, update, delete on public.campus_cal_types to authenticated;
grant insert, update, delete on public.campus_annual_calendar to authenticated;

-- 4. Enable RLS and setup universal SELECT policies
alter table public.campus_cal_types enable row level security;
alter table public.campus_annual_calendar enable row level security;

drop policy if exists campus_cal_types_read on public.campus_cal_types;
create policy campus_cal_types_read on public.campus_cal_types
  for select to public
  using (true);

drop policy if exists campus_cal_types_write on public.campus_cal_types;
create policy campus_cal_types_write on public.campus_cal_types
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists campus_annual_cal_read on public.campus_annual_calendar;
create policy campus_annual_cal_read on public.campus_annual_calendar
  for select to public
  using (true);

drop policy if exists campus_annual_cal_write on public.campus_annual_calendar;
create policy campus_annual_cal_write on public.campus_annual_calendar
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- 5. Universal RPC Function with SECURITY DEFINER
-- Reads events from campus_annual_calendar table, or automatically falls back to Admin teacher_data
create or replace function public.get_campus_annual_calendar()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  events_json jsonb;
begin
  -- Step A: Try from campus_annual_calendar table first
  select jsonb_agg(
    jsonb_build_object(
      'id', c.id::text,
      'title', c.title,
      'event_type', c.event_type,
      'from_date', c.from_date,
      'to_date', c.to_date,
      'description', coalesce(c.description, '')
    )
  ) into events_json
  from (
    select id, title, event_type, from_date, to_date, description
    from public.campus_annual_calendar
    order by from_date asc
  ) c;

  if events_json is not null and jsonb_array_length(events_json) > 0 then
    return events_json;
  end if;

  -- Step B: If table is empty, retrieve from Admin teacher_data (content->'cal')
  select jsonb_agg(
    jsonb_build_object(
      'id', coalesce(elem->>'id', gen_random_uuid()::text),
      'title', coalesce(elem->>'title', elem->>'type', 'Campus Event'),
      'event_type', coalesce(elem->>'type', 'Event'),
      'from_date', coalesce(elem->>'from', ''),
      'to_date', elem->>'to',
      'description', ''
    )
  ) into events_json
  from public.teacher_data td
  join public.user_roles r on r.user_id = td.teacher_id
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(td.content->'cal') = 'array' then td.content->'cal'
      else '[]'::jsonb
    end
  ) elem
  where r.role = 'admin';

  return coalesce(events_json, '[]'::jsonb);
end $$;

grant execute on function public.get_campus_annual_calendar() to anon, authenticated, public;
