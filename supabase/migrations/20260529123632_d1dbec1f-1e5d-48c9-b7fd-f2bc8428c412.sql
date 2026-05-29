
DROP POLICY IF EXISTS "owner update org" ON public.organizations;
CREATE POLICY "owner update org" ON public.organizations
  FOR UPDATE TO authenticated
  USING (id = public.current_org_id() AND public.has_role(auth.uid(), 'owner', id))
  WITH CHECK (id = public.current_org_id() AND public.has_role(auth.uid(), 'owner', id));

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

DROP POLICY IF EXISTS "insert own profile" ON public.profiles;
