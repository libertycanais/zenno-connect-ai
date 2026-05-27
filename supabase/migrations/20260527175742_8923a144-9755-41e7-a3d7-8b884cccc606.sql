
-- =========== META AD ACCOUNTS ===========
CREATE TABLE public.meta_ad_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ad_account_id TEXT NOT NULL,
  business_id TEXT,
  name TEXT NOT NULL,
  access_token TEXT,
  token_expires_at TIMESTAMPTZ,
  pixel_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  connected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, ad_account_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_ad_accounts TO authenticated;
GRANT ALL ON public.meta_ad_accounts TO service_role;
ALTER TABLE public.meta_ad_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read meta accounts" ON public.meta_ad_accounts
  FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "admins insert meta accounts" ON public.meta_ad_accounts
  FOR INSERT TO authenticated WITH CHECK (
    organization_id = public.current_org_id() AND (
      public.has_role(auth.uid(),'owner', organization_id) OR
      public.has_role(auth.uid(),'admin', organization_id)
    )
  );
CREATE POLICY "admins update meta accounts" ON public.meta_ad_accounts
  FOR UPDATE TO authenticated USING (
    organization_id = public.current_org_id() AND (
      public.has_role(auth.uid(),'owner', organization_id) OR
      public.has_role(auth.uid(),'admin', organization_id)
    )
  );
CREATE POLICY "admins delete meta accounts" ON public.meta_ad_accounts
  FOR DELETE TO authenticated USING (
    organization_id = public.current_org_id() AND (
      public.has_role(auth.uid(),'owner', organization_id) OR
      public.has_role(auth.uid(),'admin', organization_id)
    )
  );

CREATE TRIGGER trg_meta_accounts_touch BEFORE UPDATE ON public.meta_ad_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========== META CAMPAIGNS ===========
CREATE TABLE public.meta_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ad_account_id UUID NOT NULL REFERENCES public.meta_ad_accounts(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  objective TEXT,
  status TEXT,
  daily_budget NUMERIC(14,2),
  lifetime_budget NUMERIC(14,2),
  start_time TIMESTAMPTZ,
  stop_time TIMESTAMPTZ,
  raw JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ad_account_id, external_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_campaigns TO authenticated;
GRANT ALL ON public.meta_campaigns TO service_role;
ALTER TABLE public.meta_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read campaigns" ON public.meta_campaigns
  FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "admins write campaigns" ON public.meta_campaigns
  FOR ALL TO authenticated USING (
    organization_id = public.current_org_id() AND (
      public.has_role(auth.uid(),'owner', organization_id) OR
      public.has_role(auth.uid(),'admin', organization_id) OR
      public.has_role(auth.uid(),'manager', organization_id)
    )
  ) WITH CHECK (
    organization_id = public.current_org_id() AND (
      public.has_role(auth.uid(),'owner', organization_id) OR
      public.has_role(auth.uid(),'admin', organization_id) OR
      public.has_role(auth.uid(),'manager', organization_id)
    )
  );

CREATE TRIGGER trg_meta_campaigns_touch BEFORE UPDATE ON public.meta_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_meta_campaigns_org ON public.meta_campaigns(organization_id);
CREATE INDEX idx_meta_campaigns_account ON public.meta_campaigns(ad_account_id);

-- =========== META CONVERSION EVENTS ===========
CREATE TABLE public.meta_conversion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ad_account_id UUID REFERENCES public.meta_ad_accounts(id) ON DELETE SET NULL,
  pixel_id TEXT,
  event_name TEXT NOT NULL,
  event_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_id TEXT,
  action_source TEXT DEFAULT 'website',
  event_source_url TEXT,
  user_data JSONB,
  custom_data JSONB,
  test_event_code TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  response JSONB,
  error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_conversion_events TO authenticated;
GRANT ALL ON public.meta_conversion_events TO service_role;
ALTER TABLE public.meta_conversion_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read conv events" ON public.meta_conversion_events
  FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "org members insert conv events" ON public.meta_conversion_events
  FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_org_id());

CREATE INDEX idx_meta_conv_org_time ON public.meta_conversion_events(organization_id, event_time DESC);

-- =========== META ADS INSIGHTS ===========
CREATE TABLE public.meta_ads_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ad_account_id UUID NOT NULL REFERENCES public.meta_ad_accounts(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.meta_campaigns(id) ON DELETE CASCADE,
  date_start DATE NOT NULL,
  date_stop DATE NOT NULL,
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  spend NUMERIC(14,2) NOT NULL DEFAULT 0,
  conversions BIGINT NOT NULL DEFAULT 0,
  ctr NUMERIC(10,4),
  cpc NUMERIC(10,4),
  cpm NUMERIC(10,4),
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, date_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_ads_insights TO authenticated;
GRANT ALL ON public.meta_ads_insights TO service_role;
ALTER TABLE public.meta_ads_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read insights" ON public.meta_ads_insights
  FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "admins write insights" ON public.meta_ads_insights
  FOR ALL TO authenticated USING (
    organization_id = public.current_org_id() AND (
      public.has_role(auth.uid(),'owner', organization_id) OR
      public.has_role(auth.uid(),'admin', organization_id) OR
      public.has_role(auth.uid(),'manager', organization_id)
    )
  ) WITH CHECK (
    organization_id = public.current_org_id() AND (
      public.has_role(auth.uid(),'owner', organization_id) OR
      public.has_role(auth.uid(),'admin', organization_id) OR
      public.has_role(auth.uid(),'manager', organization_id)
    )
  );

CREATE INDEX idx_meta_insights_org_date ON public.meta_ads_insights(organization_id, date_start DESC);
