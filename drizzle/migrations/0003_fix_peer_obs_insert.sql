CREATE OR REPLACE FUNCTION public.profile_exists(_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ select exists (select 1 from public.profiles where id = _id) $$;
DROP POLICY IF EXISTS peer_observer_insert ON public.peer_observations;
CREATE POLICY peer_observer_insert ON public.peer_observations FOR INSERT TO authenticated
WITH CHECK (auth.uid() = observer_id AND public.is_staff_user() AND public.profile_exists(teacher_id));