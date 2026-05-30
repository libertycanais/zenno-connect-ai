
-- 1) chave pública de rastreio por organização
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS tracking_public_key text UNIQUE;

UPDATE public.organizations
  SET tracking_public_key = 'pk_' || replace(gen_random_uuid()::text, '-', '')
  WHERE tracking_public_key IS NULL;

ALTER TABLE public.organizations
  ALTER COLUMN tracking_public_key SET NOT NULL,
  ALTER COLUMN tracking_public_key SET DEFAULT ('pk_' || replace(gen_random_uuid()::text, '-', ''));

-- 2) tracking_events: cada hit do pixel
CREATE TABLE IF NOT EXISTS public.tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  session_id text NOT NULL,
  event_name text NOT NULL,
  event_source_url text,
  referrer text,
  page_title text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  utm_id text,
  fbclid text,
  gclid text,
  gbraid text,
  wbraid text,
  ttclid text,
  msclkid text,
  email text,
  phone text,
  external_id text,
  value numeric,
  currency text,
  ip text,
  user_agent text,
  country text,
  city text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tracking_events_org_created_idx ON public.tracking_events (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tracking_events_session_idx ON public.tracking_events (organization_id, session_id);
CREATE INDEX IF NOT EXISTS tracking_events_fbclid_idx ON public.tracking_events (organization_id, fbclid) WHERE fbclid IS NOT NULL;
CREATE INDEX IF NOT EXISTS tracking_events_gclid_idx ON public.tracking_events (organization_id, gclid) WHERE gclid IS NOT NULL;
CREATE INDEX IF NOT EXISTS tracking_events_campaign_idx ON public.tracking_events (organization_id, utm_campaign);

GRANT SELECT ON public.tracking_events TO authenticated;
GRANT ALL ON public.tracking_events TO service_role;

ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org read tracking events" ON public.tracking_events
  FOR SELECT TO authenticated
  USING (organization_id = app_private.current_org_id());

CREATE POLICY "managers delete tracking events" ON public.tracking_events
  FOR DELETE TO authenticated
  USING (organization_id = app_private.current_org_id()
    AND (app_private.has_role(auth.uid(), 'owner'::app_role, organization_id)
      OR app_private.has_role(auth.uid(), 'admin'::app_role, organization_id)
      OR app_private.has_role(auth.uid(), 'manager'::app_role, organization_id)));

-- 3) tracking_leads: consolidado por sessão/email/telefone
CREATE TABLE IF NOT EXISTS public.tracking_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  session_id text NOT NULL,
  email text,
  phone text,
  name text,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  first_utm_source text,
  first_utm_medium text,
  first_utm_campaign text,
  first_utm_term text,
  first_utm_content text,
  first_utm_id text,
  first_fbclid text,
  first_gclid text,
  first_referrer text,
  first_landing_url text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_utm_source text,
  last_utm_medium text,
  last_utm_campaign text,
  last_fbclid text,
  last_gclid text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  events_count integer NOT NULL DEFAULT 0,
  conversion_value numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'visitor',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, session_id)
);

CREATE INDEX IF NOT EXISTS tracking_leads_org_seen_idx ON public.tracking_leads (organization_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS tracking_leads_org_email_idx ON public.tracking_leads (organization_id, email);
CREATE INDEX IF NOT EXISTS tracking_leads_org_phone_idx ON public.tracking_leads (organization_id, phone);
CREATE INDEX IF NOT EXISTS tracking_leads_org_camp_idx ON public.tracking_leads (organization_id, first_utm_campaign);

GRANT SELECT ON public.tracking_leads TO authenticated;
GRANT ALL ON public.tracking_leads TO service_role;

ALTER TABLE public.tracking_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org read tracking leads" ON public.tracking_leads
  FOR SELECT TO authenticated
  USING (organization_id = app_private.current_org_id());

CREATE POLICY "managers delete tracking leads" ON public.tracking_leads
  FOR DELETE TO authenticated
  USING (organization_id = app_private.current_org_id()
    AND (app_private.has_role(auth.uid(), 'owner'::app_role, organization_id)
      OR app_private.has_role(auth.uid(), 'admin'::app_role, organization_id)
      OR app_private.has_role(auth.uid(), 'manager'::app_role, organization_id)));

CREATE TRIGGER tracking_leads_touch
  BEFORE UPDATE ON public.tracking_leads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
