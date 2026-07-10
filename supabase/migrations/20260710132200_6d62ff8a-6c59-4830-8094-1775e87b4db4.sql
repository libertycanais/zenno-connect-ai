
-- EPIC I — Executive Intelligence · additive persistence layer
-- 100% additive. No changes to existing tables, policies, or RLS.

-- ============================================================
-- ai_executive_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_executive_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  report_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  score INTEGER NOT NULL DEFAULT 0,
  summary TEXT NOT NULL DEFAULT '',
  financial_impact_cents BIGINT NOT NULL DEFAULT 0,
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, report_id)
);
CREATE INDEX IF NOT EXISTS idx_ai_exec_reports_org_created
  ON public.ai_executive_reports (organization_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_executive_reports TO authenticated;
GRANT ALL ON public.ai_executive_reports TO service_role;

ALTER TABLE public.ai_executive_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_executive_reports FORCE ROW LEVEL SECURITY;

CREATE POLICY "exec_reports_select_own_org"
  ON public.ai_executive_reports FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
CREATE POLICY "exec_reports_insert_own_org"
  ON public.ai_executive_reports FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY "exec_reports_update_own_org"
  ON public.ai_executive_reports FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY "exec_reports_delete_own_org"
  ON public.ai_executive_reports FOR DELETE TO authenticated
  USING (organization_id = public.current_org_id());

CREATE TRIGGER trg_ai_executive_reports_touch
  BEFORE UPDATE ON public.ai_executive_reports
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- ai_scenarios
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_scenarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  baseline JSONB NOT NULL,
  changes JSONB NOT NULL,
  projected JSONB NOT NULL,
  net_impact NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_scenarios_org_created
  ON public.ai_scenarios (organization_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_scenarios TO authenticated;
GRANT ALL ON public.ai_scenarios TO service_role;

ALTER TABLE public.ai_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_scenarios FORCE ROW LEVEL SECURITY;

CREATE POLICY "ai_scenarios_select_own_org"
  ON public.ai_scenarios FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
CREATE POLICY "ai_scenarios_insert_own_org"
  ON public.ai_scenarios FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY "ai_scenarios_update_own_org"
  ON public.ai_scenarios FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY "ai_scenarios_delete_own_org"
  ON public.ai_scenarios FOR DELETE TO authenticated
  USING (organization_id = public.current_org_id());

CREATE TRIGGER trg_ai_scenarios_touch
  BEFORE UPDATE ON public.ai_scenarios
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- ai_forecasts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_forecasts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  metric TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('naive','trend','expert')),
  horizon INTEGER NOT NULL,
  series JSONB NOT NULL,
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_forecasts_org_metric_created
  ON public.ai_forecasts (organization_id, metric, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_forecasts TO authenticated;
GRANT ALL ON public.ai_forecasts TO service_role;

ALTER TABLE public.ai_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_forecasts FORCE ROW LEVEL SECURITY;

CREATE POLICY "ai_forecasts_select_own_org"
  ON public.ai_forecasts FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
CREATE POLICY "ai_forecasts_insert_own_org"
  ON public.ai_forecasts FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY "ai_forecasts_update_own_org"
  ON public.ai_forecasts FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY "ai_forecasts_delete_own_org"
  ON public.ai_forecasts FOR DELETE TO authenticated
  USING (organization_id = public.current_org_id());

CREATE TRIGGER trg_ai_forecasts_touch
  BEFORE UPDATE ON public.ai_forecasts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
