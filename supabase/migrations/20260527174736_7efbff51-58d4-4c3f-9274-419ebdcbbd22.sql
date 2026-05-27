
-- Enums
CREATE TYPE public.wa_instance_status AS ENUM ('disconnected','connecting','connected','error');
CREATE TYPE public.wa_message_direction AS ENUM ('in','out');
CREATE TYPE public.wa_message_status AS ENUM ('pending','sent','delivered','read','failed');
CREATE TYPE public.wa_message_type AS ENUM ('text','image','audio','video','document','sticker','location','contact','other');

-- WhatsApp instances
CREATE TABLE public.whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  token TEXT NOT NULL,
  instance_id TEXT,
  status public.wa_instance_status NOT NULL DEFAULT 'disconnected',
  phone_number TEXT,
  qr_code TEXT,
  webhook_secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wa_instances_org ON public.whatsapp_instances(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_instances TO authenticated;
GRANT ALL ON public.whatsapp_instances TO service_role;

ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view instances in org" ON public.whatsapp_instances
  FOR SELECT TO authenticated USING (organization_id = current_org_id());

CREATE POLICY "admins manage instances" ON public.whatsapp_instances
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = current_org_id() AND (
    public.has_role(auth.uid(),'owner',organization_id) OR
    public.has_role(auth.uid(),'admin',organization_id)
  ));

CREATE POLICY "admins update instances" ON public.whatsapp_instances
  FOR UPDATE TO authenticated
  USING (organization_id = current_org_id() AND (
    public.has_role(auth.uid(),'owner',organization_id) OR
    public.has_role(auth.uid(),'admin',organization_id)
  ));

CREATE POLICY "admins delete instances" ON public.whatsapp_instances
  FOR DELETE TO authenticated
  USING (organization_id = current_org_id() AND (
    public.has_role(auth.uid(),'owner',organization_id) OR
    public.has_role(auth.uid(),'admin',organization_id)
  ));

CREATE TRIGGER trg_wa_instances_touch BEFORE UPDATE ON public.whatsapp_instances
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- WhatsApp chats
CREATE TABLE public.whatsapp_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  unread_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (instance_id, phone)
);
CREATE INDEX idx_wa_chats_org ON public.whatsapp_chats(organization_id);
CREATE INDEX idx_wa_chats_lead ON public.whatsapp_chats(lead_id);
CREATE INDEX idx_wa_chats_last_msg ON public.whatsapp_chats(last_message_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_chats TO authenticated;
GRANT ALL ON public.whatsapp_chats TO service_role;

ALTER TABLE public.whatsapp_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view chats in org" ON public.whatsapp_chats
  FOR SELECT TO authenticated USING (organization_id = current_org_id());
CREATE POLICY "insert chats in org" ON public.whatsapp_chats
  FOR INSERT TO authenticated WITH CHECK (organization_id = current_org_id());
CREATE POLICY "update chats in org" ON public.whatsapp_chats
  FOR UPDATE TO authenticated USING (organization_id = current_org_id());
CREATE POLICY "delete chats in org" ON public.whatsapp_chats
  FOR DELETE TO authenticated
  USING (organization_id = current_org_id() AND (
    public.has_role(auth.uid(),'owner',organization_id) OR
    public.has_role(auth.uid(),'admin',organization_id)
  ));

CREATE TRIGGER trg_wa_chats_touch BEFORE UPDATE ON public.whatsapp_chats
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- WhatsApp messages
CREATE TABLE public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  chat_id UUID NOT NULL REFERENCES public.whatsapp_chats(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  external_id TEXT,
  direction public.wa_message_direction NOT NULL,
  message_type public.wa_message_type NOT NULL DEFAULT 'text',
  content TEXT,
  media_url TEXT,
  status public.wa_message_status NOT NULL DEFAULT 'pending',
  sent_by UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (instance_id, external_id)
);
CREATE INDEX idx_wa_msgs_chat ON public.whatsapp_messages(chat_id, created_at DESC);
CREATE INDEX idx_wa_msgs_org ON public.whatsapp_messages(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view messages in org" ON public.whatsapp_messages
  FOR SELECT TO authenticated USING (organization_id = current_org_id());
CREATE POLICY "insert messages in org" ON public.whatsapp_messages
  FOR INSERT TO authenticated WITH CHECK (organization_id = current_org_id());
CREATE POLICY "update messages in org" ON public.whatsapp_messages
  FOR UPDATE TO authenticated USING (organization_id = current_org_id());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_chats;
