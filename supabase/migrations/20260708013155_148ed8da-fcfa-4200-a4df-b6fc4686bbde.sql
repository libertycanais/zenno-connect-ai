
CREATE TABLE public.ai_copilot_pending_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  conversation_id UUID NOT NULL REFERENCES public.ai_copilot_conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.ai_copilot_messages(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  tool_name TEXT NOT NULL,
  tool_call_id TEXT,
  tool_args JSONB NOT NULL DEFAULT '{}'::jsonb,
  preview TEXT NOT NULL,
  platform TEXT,
  account_id UUID,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','executed','failed')),
  result JSONB,
  error TEXT,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_copilot_pending_conv ON public.ai_copilot_pending_actions(conversation_id);
CREATE INDEX idx_ai_copilot_pending_org_status ON public.ai_copilot_pending_actions(organization_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_copilot_pending_actions TO authenticated;
GRANT ALL ON public.ai_copilot_pending_actions TO service_role;

ALTER TABLE public.ai_copilot_pending_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can view pending actions"
  ON public.ai_copilot_pending_actions FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());

CREATE POLICY "org members can insert pending actions"
  ON public.ai_copilot_pending_actions FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id());

CREATE POLICY "org members can update pending actions"
  ON public.ai_copilot_pending_actions FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());

CREATE TRIGGER trg_ai_copilot_pending_touch
  BEFORE UPDATE ON public.ai_copilot_pending_actions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
