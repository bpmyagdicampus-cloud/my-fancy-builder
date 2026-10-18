CREATE TYPE public.app_role AS ENUM ('admin', 'teacher');
CREATE TABLE public.profiles (
 id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 name text NOT NULL DEFAULT '', designation text NOT NULL DEFAULT '', dept text NOT NULL DEFAULT '', campus text NOT NULL DEFAULT '', address text NOT NULL DEFAULT '', hod text NOT NULL DEFAULT '', chief text NOT NULL DEFAULT ''
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.user_roles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, role public.app_role NOT NULL DEFAULT 'teacher', UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY roles_read ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE TABLE public.teacher_data (
 teacher_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 content jsonb NOT NULL DEFAULT '{"classes":[],"units":[],"cal":[],"lessons":[],"plans":[],"diary":[],"assess":[],"acts":[],"reminders":[]}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT teacher_content_object CHECK (jsonb_typeof(content) = 'object')
);
GRANT SELECT, INSERT, UPDATE ON public.teacher_data TO authenticated;
GRANT ALL ON public.teacher_data TO service_role;
ALTER TABLE public.teacher_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY teacher_data_read ON public.teacher_data FOR SELECT TO authenticated USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY teacher_data_insert ON public.teacher_data FOR INSERT TO authenticated WITH CHECK (teacher_id = auth.uid());
CREATE POLICY teacher_data_update ON public.teacher_data FOR UPDATE TO authenticated USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
CREATE FUNCTION public.create_teacher_account() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN
 INSERT INTO public.profiles(id, name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''));
 INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'teacher');
 INSERT INTO public.teacher_data(teacher_id) VALUES (NEW.id);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.create_teacher_account() FROM PUBLIC;
CREATE TRIGGER create_teacher_account AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_teacher_account();