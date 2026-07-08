
-- 1) Colunas de atribuição em whatsapp_chats
ALTER TABLE public.whatsapp_chats
  ADD COLUMN IF NOT EXISTS tracking_session_id text,
  ADD COLUMN IF NOT EXISTS tracking_short_code text,
  ADD COLUMN IF NOT EXISTS tracking_lead_id uuid REFERENCES public.tracking_leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS first_fbclid text,
  ADD COLUMN IF NOT EXISTS first_gclid text,
  ADD COLUMN IF NOT EXISTS first_utm_source text,
  ADD COLUMN IF NOT EXISTS first_utm_campaign text,
  ADD COLUMN IF NOT EXISTS first_utm_content text,
  ADD COLUMN IF NOT EXISTS first_utm_term text,
  ADD COLUMN IF NOT EXISTS first_landing_url text,
  ADD COLUMN IF NOT EXISTS attributed_at timestamptz,
  ADD COLUMN IF NOT EXISTS conversion_status text NOT NULL DEFAULT 'lead',
  ADD COLUMN IF NOT EXISTS conversion_value numeric,
  ADD COLUMN IF NOT EXISTS conversion_currency text,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz;

CREATE INDEX IF NOT EXISTS whatsapp_chats_attrib_idx ON public.whatsapp_chats (organization_id, first_utm_campaign);
CREATE INDEX IF NOT EXISTS whatsapp_chats_session_idx ON public.whatsapp_chats (tracking_session_id);

-- 2) Tabela de códigos curtos (link do botão WhatsApp)
CREATE TABLE IF NOT EXISTS public.whatsapp_tracking_codes (
  code text PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id text NOT NULL,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);
CREATE INDEX IF NOT EXISTS wa_codes_org_idx ON public.whatsapp_tracking_codes (organization_id, created_at DESC);

GRANT ALL ON public.whatsapp_tracking_codes TO service_role;
ALTER TABLE public.whatsapp_tracking_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org read wa codes" ON public.whatsapp_tracking_codes
  FOR SELECT TO authenticated
  USING (organization_id = app_private.current_org_id());

CREATE POLICY "deny writes wa codes" ON public.whatsapp_tracking_codes
  FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
