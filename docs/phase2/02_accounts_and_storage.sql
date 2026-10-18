-- STEP 2 of 3 — run after step 1. Safe to run more than once.
-- Accounts, roles, photo/background storage and cloud-sync support for Shikshak Diary.

-- 1. Extra profile fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username    text,
  ADD COLUMN IF NOT EXISTS avatar_path text,
  ADD COLUMN IF NOT EXISTS bg          text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON public.profiles (lower(username)) WHERE username IS NOT NULL;

-- 2. Version counter used to detect "saved from two places" conflicts
ALTER TABLE public.teacher_data ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 0;

-- 3. A user may edit only these profile columns of their own row (not username, not roles)
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT  UPDATE (name, designation, dept, campus, address, hod, chief, avatar_path, bg) ON public.profiles TO authenticated;

DROP POLICY IF EXISTS profiles_admin_update ON public.profiles;
CREATE POLICY profiles_admin_update ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. Diary data: only teachers/admins write; admins can also read and write everybody's
DROP POLICY IF EXISTS teacher_data_insert ON public.teacher_data;
DROP POLICY IF EXISTS teacher_data_update ON public.teacher_data;
DROP POLICY IF EXISTS teacher_data_admin_insert ON public.teacher_data;
DROP POLICY IF EXISTS teacher_data_admin_update ON public.teacher_data;
CREATE POLICY teacher_data_insert ON public.teacher_data FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid() AND (public.has_role(auth.uid(),'teacher') OR public.has_role(auth.uid(),'admin')));
CREATE POLICY teacher_data_update ON public.teacher_data FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid() AND (public.has_role(auth.uid(),'teacher') OR public.has_role(auth.uid(),'admin')))
  WITH CHECK (teacher_id = auth.uid());
CREATE POLICY teacher_data_admin_insert ON public.teacher_data FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY teacher_data_admin_update ON public.teacher_data FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Only accounts created by the admin page get a profile/role. Anyone who signs up on their own gets nothing.
CREATE OR REPLACE FUNCTION public.create_teacher_account() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r text;
BEGIN
  IF COALESCE(NEW.raw_app_meta_data->>'provisioned', '') <> 'true' THEN RETURN NEW; END IF;
  r := COALESCE(NEW.raw_app_meta_data->>'role', 'teacher');
  IF r NOT IN ('admin', 'teacher', 'student') THEN r := 'teacher'; END IF;
  INSERT INTO public.profiles (id, name, username)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''), NEW.raw_app_meta_data->>'username')
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, r::public.app_role) ON CONFLICT DO NOTHING;
  IF r = 'admin' THEN INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'teacher') ON CONFLICT DO NOTHING; END IF;
  IF r IN ('admin', 'teacher') THEN INSERT INTO public.teacher_data (teacher_id) VALUES (NEW.id) ON CONFLICT DO NOTHING; END IF;
  RETURN NEW;
END $$;

-- 6. Private storage for profile photos and backgrounds (each user: own folder; admin: all)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', false, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS avatars_read   ON storage.objects;
DROP POLICY IF EXISTS avatars_insert ON storage.objects;
DROP POLICY IF EXISTS avatars_update ON storage.objects;
DROP POLICY IF EXISTS avatars_delete ON storage.objects;
CREATE POLICY avatars_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY avatars_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY avatars_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY avatars_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));
