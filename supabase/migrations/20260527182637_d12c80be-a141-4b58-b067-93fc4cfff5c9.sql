
CREATE TABLE public.automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL CHECK (trigger_type IN ('lead.created','lead.status_changed','finance.overdue','whatsapp.message_received','manual')),
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_automations_org_trig ON public.automations(organization_id, trigger_type) WHERE is_active = true;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automations TO authenticated;
GRANT ALL ON public.automations TO service_role;
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read automations" ON public.automations FOR SELECT TO authenticated USING (organization_id = current_org_id());
CREATE POLICY "managers write automations" ON public.automations FOR ALL TO authenticated
  USING (organization_id = current_org_id() AND (has_role(auth.uid(),'owner',organization_id) OR has_role(auth.uid(),'admin',organization_id) OR has_role(auth.uid(),'manager',organization_id)))
  WITH CHECK (organization_id = current_org_id() AND (has_role(auth.uid(),'owner',organization_id) OR has_role(auth.uid(),'admin',organization_id) OR has_role(auth.uid(),'manager',organization_id)));
CREATE TRIGGER trg_automations_upd BEFORE UPDATE ON public.automations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  automation_id uuid NOT NULL,
  trigger_payload jsonb,
  status text NOT NULL CHECK (status IN ('success','partial','error')),
  actions_result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_aruns_auto ON public.automation_runs(automation_id, created_at DESC);
GRANT SELECT, INSERT ON public.automation_runs TO authenticated;
GRANT ALL ON public.automation_runs TO service_role;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read aruns" ON public.automation_runs FOR SELECT TO authenticated USING (organization_id = current_org_id());
CREATE POLICY "org insert aruns" ON public.automation_runs FOR INSERT TO authenticated WITH CHECK (organization_id = current_org_id());
