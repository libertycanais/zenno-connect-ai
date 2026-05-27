
CREATE TABLE public.google_ad_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL,
  manager_customer_id TEXT,
  name TEXT NOT NULL,
  currency TEXT,
  timezone TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  connected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, customer_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_ad_accounts TO authenticated;
GRANT ALL ON public.google_ad_accounts TO service_role;
ALTER TABLE public.google_ad_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org read google accounts" ON public.google_ad_accounts
  FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "admins insert google accounts" ON public.google_ad_accounts
  FOR INSERT TO authenticated WITH CHECK (
    organization_id = public.current_org_id() AND (
      public.has_role(auth.uid(),'owner',organization_id) OR
      public.has_role(auth.uid(),'admin',organization_id)
    )
  );
CREATE POLICY "admins update google accounts" ON public.google_ad_accounts
  FOR UPDATE TO authenticated USING (
    organization_id = public.current_org_id() AND (
      public.has_role(auth.uid(),'owner',organization_id) OR
      public.has_role(auth.uid(),'admin',organization_id)
    )
  );
CREATE POLICY "admins delete google accounts" ON public.google_ad_accounts
  FOR DELETE TO authenticated USING (
    organization_id = public.current_org_id() AND (
      public.has_role(auth.uid(),'owner',organization_id) OR
      public.has_role(auth.uid(),'admin',organization_id)
    )
  );

CREATE TRIGGER trg_google_accounts_touch BEFORE UPDATE ON public.google_ad_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- CAMPAIGNS
CREATE TABLE public.google_ads_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.google_ad_accounts(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT,
  channel_type TEXT,
  budget_amount NUMERIC(14,2),
  start_date DATE,
  end_date DATE,
  raw JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, external_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_ads_campaigns TO authenticated;
GRANT ALL ON public.google_ads_campaigns TO service_role;
ALTER TABLE public.google_ads_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org read gads camps" ON public.google_ads_campaigns
  FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "managers write gads camps" ON public.google_ads_campaigns
  FOR ALL TO authenticated USING (
    organization_id = public.current_org_id() AND (
      public.has_role(auth.uid(),'owner',organization_id) OR
      public.has_role(auth.uid(),'admin',organization_id) OR
      public.has_role(auth.uid(),'manager',organization_id)
    )
  ) WITH CHECK (
    organization_id = public.current_org_id() AND (
      public.has_role(auth.uid(),'owner',organization_id) OR
      public.has_role(auth.uid(),'admin',organization_id) OR
      public.has_role(auth.uid(),'manager',organization_id)
    )
  );

CREATE TRIGGER trg_gads_camps_touch BEFORE UPDATE ON public.google_ads_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_gads_camps_account ON public.google_ads_campaigns(account_id);

-- OFFLINE CONVERSIONS
CREATE TABLE public.google_ads_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.google_ad_accounts(id) ON DELETE SET NULL,
  conversion_action TEXT NOT NULL,
  gclid TEXT,
  conversion_date_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  conversion_value NUMERIC(14,2),
  currency TEXT,
  order_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  response JSONB,
  error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_ads_conversions TO authenticated;
GRANT ALL ON public.google_ads_conversions TO service_role;
ALTER TABLE public.google_ads_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org read gads conv" ON public.google_ads_conversions
  FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "org insert gads conv" ON public.google_ads_conversions
  FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_org_id());

CREATE INDEX idx_gads_conv_org_time ON public.google_ads_conversions(organization_id, conversion_date_time DESC);

-- INSIGHTS
CREATE TABLE public.google_ads_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.google_ad_accounts(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.google_ads_campaigns(id) ON DELETE CASCADE,
  date_start DATE NOT NULL,
  date_stop DATE NOT NULL,
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  conversions NUMERIC(14,2) NOT NULL DEFAULT 0,
  ctr NUMERIC(10,4),
  cpc NUMERIC(10,4),
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, date_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_ads_insights TO authenticated;
GRANT ALL ON public.google_ads_insights TO service_role;
ALTER TABLE public.google_ads_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org read gads insights" ON public.google_ads_insights
  FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "managers write gads insights" ON public.google_ads_insights
  FOR ALL TO authenticated USING (
    organization_id = public.current_org_id() AND (
      public.has_role(auth.uid(),'owner',organization_id) OR
      public.has_role(auth.uid(),'admin',organization_id) OR
      public.has_role(auth.uid(),'manager',organization_id)
    )
  ) WITH CHECK (
    organization_id = public.current_org_id() AND (
      public.has_role(auth.uid(),'owner',organization_id) OR
      public.has_role(auth.uid(),'admin',organization_id) OR
      public.has_role(auth.uid(),'manager',organization_id)
    )
  );

CREATE INDEX idx_gads_insights_org_date ON public.google_ads_insights(organization_id, date_start DESC);
