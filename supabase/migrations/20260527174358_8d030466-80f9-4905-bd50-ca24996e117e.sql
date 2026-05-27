
-- 1. Org-scoped has_role overload
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role AND organization_id = _org_id
  )
$$;

-- 2. Update leads DELETE policy to use org-scoped role check
DROP POLICY IF EXISTS "delete leads in org" ON public.leads;
CREATE POLICY "delete leads in org" ON public.leads
  FOR DELETE TO authenticated
  USING (
    organization_id = current_org_id() AND (
      public.has_role(auth.uid(), 'owner', organization_id) OR
      public.has_role(auth.uid(), 'admin', organization_id) OR
      public.has_role(auth.uid(), 'manager', organization_id)
    )
  );

-- 3. Update organizations UPDATE policy to use org-scoped role check
DROP POLICY IF EXISTS "owners update own org" ON public.organizations;
CREATE POLICY "owners update own org" ON public.organizations
  FOR UPDATE TO authenticated
  USING (id = current_org_id() AND public.has_role(auth.uid(), 'owner', id));

-- 4. profiles INSERT policy: only own profile row
CREATE POLICY "insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- 5. user_roles write policies: only org owners can manage roles
CREATE POLICY "owners insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner', organization_id));

CREATE POLICY "owners update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'owner', organization_id));

CREATE POLICY "owners delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner', organization_id)
    AND user_id <> auth.uid()  -- prevent owner from removing themselves
  );

-- 6. organizations INSERT: block direct creation by authenticated users
-- (creation happens via the SECURITY DEFINER handle_new_user trigger on signup)
CREATE POLICY "no direct org insert" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (false);

-- 7. Tighten lead_activities UPDATE to row owner only
DROP POLICY IF EXISTS "update activities in org" ON public.lead_activities;
CREATE POLICY "update own activities" ON public.lead_activities
  FOR UPDATE TO authenticated
  USING (organization_id = current_org_id() AND user_id = auth.uid());

-- 8. Lock down SECURITY DEFINER helper functions: don't allow direct RPC calls
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role, uuid) FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.current_org_id() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, authenticated, anon;
