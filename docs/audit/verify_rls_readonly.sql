-- READ-ONLY CHECK. It only reads settings; it changes nothing and deletes nothing.
-- Paste into the SQL editor, press Run, and send the result table back to be reviewed.
select 'RLS enabled: ' || c.relname as item, c.relrowsecurity::text as detail
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('profiles', 'user_roles', 'teacher_data')
union all
select 'policy ' || tablename || '.' || policyname,
       cmd || ' | roles=' || roles::text || ' | using=' || coalesce(qual, '-') || ' | check=' || coalesce(with_check, '-')
from pg_policies where schemaname = 'public' and tablename in ('profiles', 'user_roles', 'teacher_data')
union all
select 'storage policy ' || policyname, cmd || ' | using=' || coalesce(qual, '-') || ' | check=' || coalesce(with_check, '-')
from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'avatars_%'
union all
select 'columns a signed-in user may UPDATE on profiles', coalesce(string_agg(column_name, ', ' order by column_name), '(none)')
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles' and grantee = 'authenticated' and privilege_type = 'UPDATE'
union all
select 'grants to anon on these tables (should be 0)', count(*)::text
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public' and table_name in ('profiles', 'user_roles', 'teacher_data')
union all
select 'avatars bucket (public should be false)', 'public=' || public::text || ' | max bytes=' || coalesce(file_size_limit::text, '-')
from storage.buckets where id = 'avatars'
union all
select 'accounts without a profile (admin-made accounts should be 0)', count(*)::text
from auth.users u left join public.profiles p on p.id = u.id where p.id is null
union all
select 'administrators', coalesce(string_agg(u.email, ', '), '(none)')
from public.user_roles r join auth.users u on u.id = r.user_id where r.role = 'admin'
union all
select 'sign-up trigger only provisions admin-made accounts',
       (position('provisioned' in pg_get_functiondef('public.create_teacher_account()'::regprocedure)) > 0)::text
order by 1;
