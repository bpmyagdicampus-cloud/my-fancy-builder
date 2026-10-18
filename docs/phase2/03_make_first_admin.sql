-- STEP 3 of 3 — make the FIRST administrator (run once).
-- Before this: in Supabase / Lovable Cloud -> Authentication -> Users -> "Add user",
-- enter your e-mail and a password, tick "Auto confirm". Then put THAT e-mail below and run.
CREATE OR REPLACE FUNCTION public.bootstrap_admin(_email text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u auth.users%ROWTYPE;
BEGIN
  SELECT * INTO u FROM auth.users WHERE lower(email) = lower(_email);
  IF NOT FOUND THEN RETURN 'No such user. Create it first under Authentication -> Users.'; END IF;
  INSERT INTO public.profiles (id, name, username)
    VALUES (u.id, COALESCE(u.raw_user_meta_data->>'name', ''), lower(_email)) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (u.id, 'admin'), (u.id, 'teacher') ON CONFLICT DO NOTHING;
  INSERT INTO public.teacher_data (teacher_id) VALUES (u.id) ON CONFLICT DO NOTHING;
  RETURN 'OK: ' || u.email || ' is now an administrator.';
END $$;
REVOKE ALL ON FUNCTION public.bootstrap_admin(text) FROM PUBLIC, anon, authenticated;

SELECT public.bootstrap_admin('PUT-YOUR-EMAIL-HERE@example.com');
