
-- P0.6 · Onda 1 Audit fix — enforce "single read surface = safe view"
-- 100% additive. No changes to Provider Layer, Billing, Tracking, or contracts.

-- 1) Split the ALL policy into write-only for admins; SELECT on base table is forbidden.
DROP POLICY IF EXISTS ai_cred_admin_all ON public.ai_provider_credentials;

CREATE POLICY ai_cred_admin_insert
  ON public.ai_provider_credentials
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_org_id()
    AND (public.has_role(auth.uid(), 'owner'::app_role, organization_id)
         OR public.has_role(auth.uid(), 'admin'::app_role, organization_id))
  );

CREATE POLICY ai_cred_admin_update
  ON public.ai_provider_credentials
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND (public.has_role(auth.uid(), 'owner'::app_role, organization_id)
         OR public.has_role(auth.uid(), 'admin'::app_role, organization_id))
  )
  WITH CHECK (
    organization_id = public.current_org_id()
    AND (public.has_role(auth.uid(), 'owner'::app_role, organization_id)
         OR public.has_role(auth.uid(), 'admin'::app_role, organization_id))
  );

CREATE POLICY ai_cred_admin_delete
  ON public.ai_provider_credentials
  FOR DELETE TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND (public.has_role(auth.uid(), 'owner'::app_role, organization_id)
         OR public.has_role(auth.uid(), 'admin'::app_role, organization_id))
  );

-- No SELECT policy: authenticated cannot read the base table. Reads MUST go
-- through public.ai_provider_credentials_safe (server-side decrypt via
-- decryptApiKey uses service_role, which bypasses RLS by design).

-- 2) Belt-and-suspenders: revoke SELECT privilege on ciphertext/nonce columns
--    from anon/authenticated so even a policy mistake in the future cannot
--    leak the encrypted material through PostgREST.
REVOKE SELECT (api_key_ciphertext, api_key_nonce)
  ON public.ai_provider_credentials FROM anon, authenticated;

-- 3) FORCE RLS on webhook_events for consistency with other P0.6 tables
--    (already ENABLE; FORCE prevents table owner from bypassing).
ALTER TABLE public.webhook_events FORCE ROW LEVEL SECURITY;
