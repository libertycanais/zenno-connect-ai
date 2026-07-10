
-- RC2 Operational Enhancements — additive; Freeze v1.0 preserved.

-- 1) Copilot contextual feedback (👍/👎). PII-safe: no prompt/response bodies.
CREATE TABLE IF NOT EXISTS public.pilot_copilot_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID,
  message_id UUID,
  conversation_id UUID,
  reaction TEXT NOT NULL CHECK (reaction IN ('up','down')),
  reason_code TEXT CHECK (reason_code IN ('inaccurate','irrelevant','incomplete','too_slow','other','helpful','actionable','clear')),
  comment TEXT CHECK (comment IS NULL OR length(comment) <= 2000),
  model_hint TEXT,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.pilot_copilot_feedback TO authenticated;
GRANT ALL ON public.pilot_copilot_feedback TO service_role;
ALTER TABLE public.pilot_copilot_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read pilot_copilot_feedback"
  ON public.pilot_copilot_feedback FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
CREATE POLICY "org members insert pilot_copilot_feedback"
  ON public.pilot_copilot_feedback FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id());
CREATE INDEX IF NOT EXISTS idx_pcf_org_time ON public.pilot_copilot_feedback(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pcf_reaction ON public.pilot_copilot_feedback(reaction, created_at DESC);

-- 2) Evidence-based backlog governance
CREATE TABLE IF NOT EXISTS public.pilot_backlog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 200),
  description TEXT CHECK (description IS NULL OR length(description) <= 4000),
  source TEXT NOT NULL CHECK (source IN ('pilot_feedback','telemetry','support','executive','internal','other')),
  evidence_ref TEXT,
  organizations_affected INTEGER NOT NULL DEFAULT 0 CHECK (organizations_affected >= 0),
  frequency INTEGER NOT NULL DEFAULT 0 CHECK (frequency >= 0),
  financial_impact_cents BIGINT NOT NULL DEFAULT 0,
  retention_impact NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (retention_impact BETWEEN 0 AND 100),
  operational_impact NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (operational_impact BETWEEN 0 AND 100),
  effort_days NUMERIC(6,2) NOT NULL DEFAULT 1 CHECK (effort_days > 0),
  priority_score NUMERIC(8,2) NOT NULL DEFAULT 0,
  priority_bucket TEXT NOT NULL DEFAULT 'P3' CHECK (priority_bucket IN ('P0','P1','P2','P3')),
  status TEXT NOT NULL DEFAULT 'triage' CHECK (status IN ('triage','accepted','deferred','rejected','shipped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.pilot_backlog_items TO authenticated;
GRANT ALL ON public.pilot_backlog_items TO service_role;
ALTER TABLE public.pilot_backlog_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read pilot_backlog_items"
  ON public.pilot_backlog_items FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
CREATE POLICY "org members insert pilot_backlog_items"
  ON public.pilot_backlog_items FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY "org members update pilot_backlog_items"
  ON public.pilot_backlog_items FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());
CREATE INDEX IF NOT EXISTS idx_pbi_org_prio ON public.pilot_backlog_items(organization_id, priority_score DESC);
CREATE TRIGGER trg_pbi_touch BEFORE UPDATE ON public.pilot_backlog_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) Telemetry rate-limit hit counter (observability of blocks)
CREATE TABLE IF NOT EXISTS public.pilot_telemetry_rate_hits (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bucket TIMESTAMPTZ NOT NULL,
  blocked_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (organization_id, bucket)
);
GRANT SELECT ON public.pilot_telemetry_rate_hits TO authenticated;
GRANT ALL ON public.pilot_telemetry_rate_hits TO service_role;
ALTER TABLE public.pilot_telemetry_rate_hits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read pilot_telemetry_rate_hits"
  ON public.pilot_telemetry_rate_hits FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());

-- 4) 90-day retention prune function for pilot_telemetry_events
CREATE OR REPLACE FUNCTION public.pilot_telemetry_prune(_days INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $$
DECLARE
  _deleted INTEGER;
BEGIN
  DELETE FROM public.pilot_telemetry_events
   WHERE occurred_at < now() - make_interval(days => GREATEST(_days, 1));
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  DELETE FROM public.pilot_telemetry_rate_hits
   WHERE bucket < now() - INTERVAL '30 days';
  RETURN _deleted;
END;
$$;

-- 5) Schedule pg_cron pruning (daily at 03:15 UTC). Uses existing pg_cron.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('pilot-telemetry-prune-90d')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pilot-telemetry-prune-90d');
    PERFORM cron.schedule(
      'pilot-telemetry-prune-90d',
      '15 3 * * *',
      $cron$ SELECT public.pilot_telemetry_prune(90); $cron$
    );
  END IF;
END $$;
