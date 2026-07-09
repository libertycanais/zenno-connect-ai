CREATE TABLE public.webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  organization_id UUID NULL REFERENCES public.organizations(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','processed','failed','skipped')),
  error_message TEXT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX webhook_events_provider_event_id_uidx
  ON public.webhook_events(provider, event_id);
CREATE INDEX webhook_events_org_received_idx
  ON public.webhook_events(organization_id, received_at DESC);
CREATE INDEX webhook_events_status_idx
  ON public.webhook_events(status);

GRANT ALL ON public.webhook_events TO service_role;

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Nenhuma policy para anon/authenticated: dados internos, apenas service_role.
-- (RLS habilitada sem policies => bloqueio total para roles não-service.)