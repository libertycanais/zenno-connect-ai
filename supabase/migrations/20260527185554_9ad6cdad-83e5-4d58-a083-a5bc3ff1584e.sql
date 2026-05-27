CREATE TABLE IF NOT EXISTS public.oauth_states (
  state text PRIMARY KEY,
  provider text NOT NULL,
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  consumed_at timestamptz
);
GRANT ALL ON public.oauth_states TO service_role;
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS oauth_states_expires_idx ON public.oauth_states (expires_at);

DROP POLICY IF EXISTS "org members read meta accounts" ON public.meta_ad_accounts;
DROP POLICY IF EXISTS "org read meta accounts" ON public.meta_ad_accounts;
CREATE POLICY "admins read meta accounts"
ON public.meta_ad_accounts FOR SELECT TO authenticated
USING (organization_id = current_org_id() AND (has_role(auth.uid(), 'owner'::app_role, organization_id) OR has_role(auth.uid(), 'admin'::app_role, organization_id)));

DROP POLICY IF EXISTS "org read google accounts" ON public.google_ad_accounts;
CREATE POLICY "admins read google accounts"
ON public.google_ad_accounts FOR SELECT TO authenticated
USING (organization_id = current_org_id() AND (has_role(auth.uid(), 'owner'::app_role, organization_id) OR has_role(auth.uid(), 'admin'::app_role, organization_id)));

UPDATE public.whatsapp_instances SET webhook_secret = encode(extensions.gen_random_bytes(24), 'hex');