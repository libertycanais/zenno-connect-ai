CREATE TABLE public.sigma_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  base_url TEXT NOT NULL,
  auth_type TEXT NOT NULL DEFAULT 'none',
  auth_token TEXT,
  headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sigma_integrations TO authenticated;
GRANT ALL ON public.sigma_integrations TO service_role;

ALTER TABLE public.sigma_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org read sigma" ON public.sigma_integrations FOR SELECT TO authenticated
USING (organization_id = current_org_id());

CREATE POLICY "admins insert sigma" ON public.sigma_integrations FOR INSERT TO authenticated
WITH CHECK (organization_id = current_org_id() AND (
  has_role(auth.uid(), 'owner'::app_role, organization_id) OR
  has_role(auth.uid(), 'admin'::app_role, organization_id)
));

CREATE POLICY "admins update sigma" ON public.sigma_integrations FOR UPDATE TO authenticated
USING (organization_id = current_org_id() AND (
  has_role(auth.uid(), 'owner'::app_role, organization_id) OR
  has_role(auth.uid(), 'admin'::app_role, organization_id)
));

CREATE POLICY "admins delete sigma" ON public.sigma_integrations FOR DELETE TO authenticated
USING (organization_id = current_org_id() AND (
  has_role(auth.uid(), 'owner'::app_role, organization_id) OR
  has_role(auth.uid(), 'admin'::app_role, organization_id)
));

CREATE TRIGGER sigma_touch BEFORE UPDATE ON public.sigma_integrations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.sigma_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  integration_id UUID NOT NULL,
  method TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  request_body JSONB,
  response_status INT,
  response_body JSONB,
  error TEXT,
  duration_ms INT,
  triggered_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.sigma_requests TO authenticated;
GRANT ALL ON public.sigma_requests TO service_role;

ALTER TABLE public.sigma_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org read sigma req" ON public.sigma_requests FOR SELECT TO authenticated
USING (organization_id = current_org_id());

CREATE POLICY "org insert sigma req" ON public.sigma_requests FOR INSERT TO authenticated
WITH CHECK (organization_id = current_org_id());

CREATE INDEX idx_sigma_req_int ON public.sigma_requests(integration_id, created_at DESC);