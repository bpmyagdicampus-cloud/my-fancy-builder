-- ============================================================
-- पप-अप सूचना (Popup Notice) — Supabase SQL Editor मा run गर्नुहोस्
-- Requires: public.has_role(uuid, app_role) (docs/phase2 बाट पहिले नै बनेको)
-- Safe to re-run (idempotent).
-- ============================================================

create table if not exists public.popup_notices (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  content     text not null,
  notice_type text not null default 'general'
              check (notice_type in ('general', 'urgent', 'holiday')),
  is_active   boolean not null default true,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists popup_notices_is_active_idx
  on public.popup_notices (is_active);
create index if not exists popup_notices_created_at_idx
  on public.popup_notices (created_at desc);

-- keep updated_at fresh
create or replace function public.popup_notices_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists popup_notices_touch on public.popup_notices;
create trigger popup_notices_touch
  before update on public.popup_notices
  for each row execute function public.popup_notices_touch();

-- ---------- Row Level Security ----------
alter table public.popup_notices enable row level security;

drop policy if exists "popup_notices_read_active" on public.popup_notices;
drop policy if exists "popup_notices_admin_read_all" on public.popup_notices;
drop policy if exists "popup_notices_admin_insert" on public.popup_notices;
drop policy if exists "popup_notices_admin_update" on public.popup_notices;
drop policy if exists "popup_notices_admin_delete" on public.popup_notices;

-- सबैले (login नगरेकाले पनि) सक्रिय सूचना पढ्न सक्छन्
create policy "popup_notices_read_active"
  on public.popup_notices for select
  to anon, authenticated
  using (is_active = true);

-- admin ले सबै (निष्क्रिय सहित) पढ्न सक्छ
create policy "popup_notices_admin_read_all"
  on public.popup_notices for select
  to authenticated
  using (exists (select 1 from public.user_roles ur
                 where ur.user_id = auth.uid() and ur.role = 'admin'));

-- केवल admin ले थप्न / सच्याउन / मेट्न सक्छ
create policy "popup_notices_admin_insert"
  on public.popup_notices for insert
  to authenticated
  with check (exists (select 1 from public.user_roles ur
                      where ur.user_id = auth.uid() and ur.role = 'admin'));

create policy "popup_notices_admin_update"
  on public.popup_notices for update
  to authenticated
  using (exists (select 1 from public.user_roles ur
                 where ur.user_id = auth.uid() and ur.role = 'admin'))
  with check (exists (select 1 from public.user_roles ur
                      where ur.user_id = auth.uid() and ur.role = 'admin'));

create policy "popup_notices_admin_delete"
  on public.popup_notices for delete
  to authenticated
  using (exists (select 1 from public.user_roles ur
                 where ur.user_id = auth.uid() and ur.role = 'admin'));

-- table privileges (RLS ले अझै सीमित गर्छ)
grant select on public.popup_notices to anon, authenticated;
grant insert, update, delete on public.popup_notices to authenticated;
