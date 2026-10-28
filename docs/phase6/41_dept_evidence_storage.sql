-- DEPARTMENT MANAGEMENT — private storage for evidence files (photos, minutes, documents). Needed from Stage 3.
-- Run AFTER 40_dept_mgmt.sql. Additive. Safe to run more than once.
-- If your database does not allow policies on storage.objects, tell Claude the exact error message.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dept-evidence', 'dept-evidence', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do nothing;

-- file path rule:  <department id>/<file name>
drop policy if exists dept_evidence_read on storage.objects;
create policy dept_evidence_read on storage.objects for select to authenticated
  using (bucket_id = 'dept-evidence' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
         and public.dm_can_read(((storage.foldername(name))[1])::uuid));
drop policy if exists dept_evidence_insert on storage.objects;
create policy dept_evidence_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'dept-evidence' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
         and public.dm_can_read(((storage.foldername(name))[1])::uuid));
drop policy if exists dept_evidence_delete on storage.objects;
create policy dept_evidence_delete on storage.objects for delete to authenticated
  using (bucket_id = 'dept-evidence' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
         and public.can_manage_dept(((storage.foldername(name))[1])::uuid));
