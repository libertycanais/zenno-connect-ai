-- Tickets table
CREATE TABLE public.tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  channel TEXT,
  lead_id UUID,
  requester_name TEXT,
  requester_email TEXT,
  requester_phone TEXT,
  assigned_to UUID,
  created_by UUID,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org read tickets" ON public.tickets FOR SELECT TO authenticated
USING (organization_id = current_org_id());

CREATE POLICY "org insert tickets" ON public.tickets FOR INSERT TO authenticated
WITH CHECK (organization_id = current_org_id());

CREATE POLICY "managers update tickets" ON public.tickets FOR UPDATE TO authenticated
USING (organization_id = current_org_id() AND (
  has_role(auth.uid(), 'owner'::app_role, organization_id) OR
  has_role(auth.uid(), 'admin'::app_role, organization_id) OR
  has_role(auth.uid(), 'manager'::app_role, organization_id)
));

CREATE POLICY "managers delete tickets" ON public.tickets FOR DELETE TO authenticated
USING (organization_id = current_org_id() AND (
  has_role(auth.uid(), 'owner'::app_role, organization_id) OR
  has_role(auth.uid(), 'admin'::app_role, organization_id) OR
  has_role(auth.uid(), 'manager'::app_role, organization_id)
));

CREATE TRIGGER tickets_touch_updated_at BEFORE UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_tickets_org_status ON public.tickets(organization_id, status);
CREATE INDEX idx_tickets_assigned ON public.tickets(assigned_to);

-- Ticket messages
CREATE TABLE public.ticket_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  ticket_id UUID NOT NULL,
  author_id UUID,
  body TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  attachments JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_messages TO authenticated;
GRANT ALL ON public.ticket_messages TO service_role;

ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org read tmsg" ON public.ticket_messages FOR SELECT TO authenticated
USING (organization_id = current_org_id());

CREATE POLICY "org insert tmsg" ON public.ticket_messages FOR INSERT TO authenticated
WITH CHECK (organization_id = current_org_id());

CREATE POLICY "author update tmsg" ON public.ticket_messages FOR UPDATE TO authenticated
USING (organization_id = current_org_id() AND author_id = auth.uid());

CREATE POLICY "author delete tmsg" ON public.ticket_messages FOR DELETE TO authenticated
USING (organization_id = current_org_id() AND author_id = auth.uid());

CREATE INDEX idx_tmsg_ticket ON public.ticket_messages(ticket_id, created_at);