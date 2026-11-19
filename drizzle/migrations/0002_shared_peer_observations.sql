CREATE TABLE public.peer_observations (id text PRIMARY KEY, observer_id uuid NOT NULL, teacher_id uuid NOT NULL, content jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT peer_observation_content_object CHECK (jsonb_typeof(content) = 'object'));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.peer_observations TO authenticated;
GRANT ALL ON public.peer_observations TO service_role;
ALTER TABLE public.peer_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY peer_participants_read ON public.peer_observations FOR SELECT TO authenticated USING (auth.uid() = observer_id OR auth.uid() = teacher_id);
CREATE POLICY peer_observer_insert ON public.peer_observations FOR INSERT TO authenticated WITH CHECK (auth.uid() = observer_id AND public.is_staff_user() AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = teacher_id));
CREATE POLICY peer_participants_update ON public.peer_observations FOR UPDATE TO authenticated USING (auth.uid() = observer_id OR auth.uid() = teacher_id) WITH CHECK (auth.uid() = observer_id OR auth.uid() = teacher_id);
CREATE POLICY peer_observer_delete ON public.peer_observations FOR DELETE TO authenticated USING (auth.uid() = observer_id);
CREATE FUNCTION public.peer_observation_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.observer_id IS DISTINCT FROM OLD.observer_id OR NEW.id IS DISTINCT FROM OLD.id THEN RAISE EXCEPTION 'Observation owner cannot change'; END IF;
    IF auth.uid() = OLD.teacher_id AND auth.uid() IS DISTINCT FROM OLD.observer_id THEN
      IF NEW.teacher_id IS DISTINCT FROM OLD.teacher_id OR (NEW.content - ARRAY['teacherAck','teacherDate','updatedAt']) IS DISTINCT FROM (OLD.content - ARRAY['teacherAck','teacherDate','updatedAt']) THEN RAISE EXCEPTION 'Teachers may update only their acknowledgement'; END IF;
    END IF;
  END IF;
  NEW.content := NEW.content || jsonb_build_object('id', NEW.id, 'observerId', NEW.observer_id::text, 'teacherId', NEW.teacher_id::text);
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER peer_observation_guard_trg BEFORE INSERT OR UPDATE ON public.peer_observations FOR EACH ROW EXECUTE FUNCTION public.peer_observation_guard();