CREATE TABLE public.payment_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('asaas','mercadopago')),
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','production')),
  api_key text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled','error')),
  last_checked_at timestamptz,
  last_error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, provider)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_integrations TO authenticated;
GRANT ALL ON public.payment_integrations TO service_role;

ALTER TABLE public.payment_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read payment integrations" ON public.payment_integrations
  FOR SELECT TO authenticated
  USING (organization_id = app_private.current_org_id()
    AND (app_private.has_role(auth.uid(),'owner'::app_role,organization_id)
      OR app_private.has_role(auth.uid(),'admin'::app_role,organization_id)));

CREATE POLICY "admins insert payment integrations" ON public.payment_integrations
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = app_private.current_org_id()
    AND (app_private.has_role(auth.uid(),'owner'::app_role,organization_id)
      OR app_private.has_role(auth.uid(),'admin'::app_role,organization_id)));

CREATE POLICY "admins update payment integrations" ON public.payment_integrations
  FOR UPDATE TO authenticated
  USING (organization_id = app_private.current_org_id()
    AND (app_private.has_role(auth.uid(),'owner'::app_role,organization_id)
      OR app_private.has_role(auth.uid(),'admin'::app_role,organization_id)));

CREATE POLICY "admins delete payment integrations" ON public.payment_integrations
  FOR DELETE TO authenticated
  USING (organization_id = app_private.current_org_id()
    AND (app_private.has_role(auth.uid(),'owner'::app_role,organization_id)
      OR app_private.has_role(auth.uid(),'admin'::app_role,organization_id)));

CREATE TRIGGER payment_integrations_touch BEFORE UPDATE ON public.payment_integrations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();