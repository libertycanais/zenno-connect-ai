-- RC2 Pilot Program — additive tables (Freeze v1.0 preserved)

CREATE TABLE IF NOT EXISTS public.pilot_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  cohort TEXT NOT NULL DEFAULT 'wave-1' CHECK (cohort IN ('wave-1','wave-2','wave-3','ga-candidate')),
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','onboarding','active','paused','graduated','churned')),
  activated_at TIMESTAMPTZ,
  health_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  adoption_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  ttfv_seconds INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pilot_organizations TO authenticated;
GRANT ALL ON public.pilot_organizations TO service_role;
ALTER TABLE public.pilot_organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read pilot_organizations"
  ON public.pilot_organizations FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());

CREATE TABLE IF NOT EXISTS public.pilot_telemetry_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID,
  event_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'product' CHECK (category IN ('product','ai','error','session','onboarding')),
  props JSONB NOT NULL DEFAULT '{}'::jsonb,
  session_id TEXT,
  latency_ms INTEGER,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.pilot_telemetry_events TO authenticated;
GRANT ALL ON public.pilot_telemetry_events TO service_role;
ALTER TABLE public.pilot_telemetry_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read pilot_telemetry_events"
  ON public.pilot_telemetry_events FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
CREATE POLICY "org members insert pilot_telemetry_events"
  ON public.pilot_telemetry_events FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id());
CREATE INDEX IF NOT EXISTS idx_pte_org_time ON public.pilot_telemetry_events(organization_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_pte_event ON public.pilot_telemetry_events(event_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_pte_category ON public.pilot_telemetry_events(category, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.pilot_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID,
  kind TEXT NOT NULL CHECK (kind IN ('nps','csat','open','bug','feature_request')),
  score INTEGER CHECK (score BETWEEN 0 AND 10),
  feature TEXT,
  comment TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive','neutral','negative')),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.pilot_feedback TO authenticated;
GRANT ALL ON public.pilot_feedback TO service_role;
ALTER TABLE public.pilot_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read pilot_feedback"
  ON public.pilot_feedback FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
CREATE POLICY "org members insert pilot_feedback"
  ON public.pilot_feedback FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id());
CREATE INDEX IF NOT EXISTS idx_pfb_org_time ON public.pilot_feedback(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pfb_kind ON public.pilot_feedback(kind, created_at DESC);

CREATE TABLE IF NOT EXISTS public.pilot_onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  step_key TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id, step_key)
);
GRANT SELECT, INSERT, DELETE ON public.pilot_onboarding_progress TO authenticated;
GRANT ALL ON public.pilot_onboarding_progress TO service_role;
ALTER TABLE public.pilot_onboarding_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read pilot_onboarding_progress"
  ON public.pilot_onboarding_progress FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
CREATE POLICY "org members write pilot_onboarding_progress"
  ON public.pilot_onboarding_progress FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id());