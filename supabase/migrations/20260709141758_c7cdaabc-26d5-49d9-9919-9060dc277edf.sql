
-- EPIC D — AI Recommendation / Evidence / Playbook persistence
-- 100% additive. No changes to existing tables, policies, or functions.

-- =========================================================================
-- 1) ai_evidence
-- =========================================================================
CREATE TABLE public.ai_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  evidence_id TEXT NOT NULL,
  expert_id TEXT NOT NULL,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, evidence_id)
);

GRANT SELECT ON public.ai_evidence TO authenticated;
GRANT ALL   ON public.ai_evidence TO service_role;

ALTER TABLE public.ai_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_evidence FORCE  ROW LEVEL SECURITY;

CREATE POLICY ai_evidence_select
  ON public.ai_evidence FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());

CREATE POLICY ai_evidence_admin_insert
  ON public.ai_evidence FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_org_id()
    AND (public.has_role(auth.uid(), 'owner'::app_role, organization_id)
         OR public.has_role(auth.uid(), 'admin'::app_role, organization_id))
  );

CREATE POLICY ai_evidence_admin_update
  ON public.ai_evidence FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id()
         AND (public.has_role(auth.uid(), 'owner'::app_role, organization_id)
              OR public.has_role(auth.uid(), 'admin'::app_role, organization_id)))
  WITH CHECK (organization_id = public.current_org_id());

CREATE POLICY ai_evidence_admin_delete
  ON public.ai_evidence FOR DELETE TO authenticated
  USING (organization_id = public.current_org_id()
         AND (public.has_role(auth.uid(), 'owner'::app_role, organization_id)
              OR public.has_role(auth.uid(), 'admin'::app_role, organization_id)));

CREATE INDEX ai_evidence_org_created_idx
  ON public.ai_evidence (organization_id, created_at DESC);

CREATE TRIGGER ai_evidence_touch_updated_at
  BEFORE UPDATE ON public.ai_evidence
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================================
-- 2) ai_playbooks
-- =========================================================================
CREATE TABLE public.ai_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  playbook_id TEXT NOT NULL,
  title TEXT NOT NULL,
  problem TEXT NOT NULL,
  diagnosis TEXT NOT NULL,
  impact TEXT NOT NULL,
  urgency TEXT NOT NULL CHECK (urgency IN ('low','medium','high','critical')),
  complexity TEXT NOT NULL CHECK (complexity IN ('low','medium','high')),
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  action_plan JSONB NOT NULL DEFAULT '[]'::jsonb,
  financial_estimate JSONB NOT NULL DEFAULT '{}'::jsonb,
  next_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  success_criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
  expected_outcome TEXT NOT NULL DEFAULT '',
  version TEXT NOT NULL DEFAULT '1.0.0',
  evidence_id UUID REFERENCES public.ai_evidence(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, playbook_id)
);

GRANT SELECT ON public.ai_playbooks TO authenticated;
GRANT ALL   ON public.ai_playbooks TO service_role;

ALTER TABLE public.ai_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_playbooks FORCE  ROW LEVEL SECURITY;

CREATE POLICY ai_playbook_select
  ON public.ai_playbooks FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());

CREATE POLICY ai_playbook_admin_insert
  ON public.ai_playbooks FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_org_id()
    AND (public.has_role(auth.uid(), 'owner'::app_role, organization_id)
         OR public.has_role(auth.uid(), 'admin'::app_role, organization_id))
  );

CREATE POLICY ai_playbook_admin_update
  ON public.ai_playbooks FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id()
         AND (public.has_role(auth.uid(), 'owner'::app_role, organization_id)
              OR public.has_role(auth.uid(), 'admin'::app_role, organization_id)))
  WITH CHECK (organization_id = public.current_org_id());

CREATE POLICY ai_playbook_admin_delete
  ON public.ai_playbooks FOR DELETE TO authenticated
  USING (organization_id = public.current_org_id()
         AND (public.has_role(auth.uid(), 'owner'::app_role, organization_id)
              OR public.has_role(auth.uid(), 'admin'::app_role, organization_id)));

CREATE INDEX ai_playbooks_org_created_idx
  ON public.ai_playbooks (organization_id, created_at DESC);

CREATE TRIGGER ai_playbooks_touch_updated_at
  BEFORE UPDATE ON public.ai_playbooks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================================
-- 3) ai_recommendations
-- =========================================================================
CREATE TABLE public.ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  recommendation_id TEXT NOT NULL,
  expert_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  diagnosis TEXT NOT NULL,
  problem TEXT NOT NULL,
  impact TEXT NOT NULL,
  financial_value_cents BIGINT NOT NULL DEFAULT 0,
  urgency TEXT NOT NULL CHECK (urgency IN ('low','medium','high','critical')),
  complexity TEXT NOT NULL CHECK (complexity IN ('low','medium','high')),
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','dismissed','archived')),
  evidence_id UUID REFERENCES public.ai_evidence(id) ON DELETE SET NULL,
  playbook_id UUID REFERENCES public.ai_playbooks(id) ON DELETE SET NULL,
  workflow_id TEXT,
  task_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, recommendation_id)
);

GRANT SELECT ON public.ai_recommendations TO authenticated;
GRANT ALL   ON public.ai_recommendations TO service_role;

ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_recommendations FORCE  ROW LEVEL SECURITY;

CREATE POLICY ai_recommendations_select
  ON public.ai_recommendations FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());

CREATE POLICY ai_recommendations_admin_insert
  ON public.ai_recommendations FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_org_id()
    AND (public.has_role(auth.uid(), 'owner'::app_role, organization_id)
         OR public.has_role(auth.uid(), 'admin'::app_role, organization_id))
  );

CREATE POLICY ai_recommendations_admin_update
  ON public.ai_recommendations FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id()
         AND (public.has_role(auth.uid(), 'owner'::app_role, organization_id)
              OR public.has_role(auth.uid(), 'admin'::app_role, organization_id)))
  WITH CHECK (organization_id = public.current_org_id());

CREATE POLICY ai_recommendations_admin_delete
  ON public.ai_recommendations FOR DELETE TO authenticated
  USING (organization_id = public.current_org_id()
         AND (public.has_role(auth.uid(), 'owner'::app_role, organization_id)
              OR public.has_role(auth.uid(), 'admin'::app_role, organization_id)));

CREATE INDEX ai_recommendations_org_created_idx
  ON public.ai_recommendations (organization_id, created_at DESC);

CREATE INDEX ai_recommendations_status_idx
  ON public.ai_recommendations (organization_id, status);

CREATE TRIGGER ai_recommendations_touch_updated_at
  BEFORE UPDATE ON public.ai_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
