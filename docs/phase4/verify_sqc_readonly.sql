-- READ-ONLY CHECK for batches 3 and 4. Changes nothing. Run, then send the result table.
select 'table exists: ' || t.name as item, (to_regclass('public.' || t.name) is not null)::text as detail
from (values ('academic_years'), ('sqc_classes'), ('sqc_members'), ('sqc_periods'), ('sqc_reports'), ('sqc_actions')) as t(name)
union all
select 'RLS enabled: ' || c.relname, c.relrowsecurity::text
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('academic_years', 'sqc_classes', 'sqc_members', 'sqc_periods', 'sqc_reports', 'sqc_actions')
union all
select 'policy ' || tablename || '.' || policyname, cmd || ' | using=' || coalesce(qual, '-') || ' | check=' || coalesce(with_check, '-')
from pg_policies where schemaname = 'public' and (tablename like 'sqc\_%' or tablename = 'academic_years')
union all
select 'grants to anon (should be 0)', count(*)::text
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public' and (table_name like 'sqc\_%' or table_name = 'academic_years')
union all
select 'functions', coalesce(string_agg(proname, ', ' order by proname), '(none)')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and proname in ('set_active_academic_year', 'sqc_is_member', 'sqc_is_rep', 'sqc_teacher_list', 'sqc_reports_guard', 'sqc_actions_sync')
union all
select 'only one active year allowed (index exists)', (to_regclass('public.academic_years_one_active') is not null)::text
order by 1;
