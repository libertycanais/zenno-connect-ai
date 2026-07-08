CREATE TABLE public.ai_copilot_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nova conversa',
  active_client_account_id UUID,
  active_client_platform TEXT CHECK (active_client_platform IN ('meta','google')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_copilot_conv_org ON public.ai_copilot_conversations(organization_id, updated_at DESC);
CREATE INDEX idx_copilot_conv_user ON public.ai_copilot_conversations(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_copilot_conversations TO authenticated;
GRANT ALL ON public.ai_copilot_conversations TO service_role;
ALTER TABLE public.ai_copilot_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copilot_conv_select_own_org" ON public.ai_copilot_conversations FOR SELECT TO authenticated USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "copilot_conv_insert_own" ON public.ai_copilot_conversations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "copilot_conv_update_own" ON public.ai_copilot_conversations FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "copilot_conv_delete_own" ON public.ai_copilot_conversations FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.ai_copilot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_copilot_conversations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','tool','system')),
  content TEXT,
  tool_calls JSONB,
  tool_call_id TEXT,
  tool_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_copilot_msg_conv ON public.ai_copilot_messages(conversation_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_copilot_messages TO authenticated;
GRANT ALL ON public.ai_copilot_messages TO service_role;
ALTER TABLE public.ai_copilot_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copilot_msg_select_own_org" ON public.ai_copilot_messages FOR SELECT TO authenticated USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "copilot_msg_insert_own_org" ON public.ai_copilot_messages FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "copilot_msg_delete_own_org" ON public.ai_copilot_messages FOR DELETE TO authenticated USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));