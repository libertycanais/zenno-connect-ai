-- Tighten SELECT policies to prevent token/credential exposure to non-admin org members

-- sigma_integrations: only owner/admin can SELECT directly (server fns use service role for safe listing)
DROP POLICY IF EXISTS "org read sigma" ON public.sigma_integrations;
CREATE POLICY "admins read sigma"
ON public.sigma_integrations
FOR SELECT
TO authenticated
USING (
  organization_id = current_org_id()
  AND (has_role(auth.uid(), 'owner'::app_role, organization_id)
       OR has_role(auth.uid(), 'admin'::app_role, organization_id))
);

-- whatsapp_instances: only owner/admin can SELECT directly (server fns expose safe columns for other members)
DROP POLICY IF EXISTS "view instances in org" ON public.whatsapp_instances;
CREATE POLICY "admins read instances"
ON public.whatsapp_instances
FOR SELECT
TO authenticated
USING (
  organization_id = current_org_id()
  AND (has_role(auth.uid(), 'owner'::app_role, organization_id)
       OR has_role(auth.uid(), 'admin'::app_role, organization_id))
);