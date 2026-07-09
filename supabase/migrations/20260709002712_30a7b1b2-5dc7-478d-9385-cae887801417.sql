-- =========================================================
-- Feature P0.1 — Billing & Subscriptions (aditivo)
-- Baseline: Architecture Freeze v1.0
-- =========================================================

-- 1) plans (catálogo global) ---------------------------------
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL' CHECK (char_length(currency) = 3),
  interval TEXT NOT NULL DEFAULT 'month' CHECK (interval IN ('month','year')),
  trial_days INTEGER NOT NULL DEFAULT 0 CHECK (trial_days >= 0),
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.plans TO anon;
GRANT SELECT ON public.plans TO authenticated;
GRANT ALL    ON public.plans TO service_role;

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plans_read_anon"
  ON public.plans FOR SELECT TO anon
  USING (active = true);

CREATE POLICY "plans_read_authenticated"
  ON public.plans FOR SELECT TO authenticated
  USING (true);

-- Sem policy de INSERT/UPDATE/DELETE para anon/authenticated: catálogo é
-- mantido via service_role (server functions administrativas).

CREATE INDEX IF NOT EXISTS idx_plans_active_sort
  ON public.plans (active, sort_order);

CREATE TRIGGER trg_plans_touch_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) subscription_events (histórico) -------------------------
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created','trial_started','checkout_started','activated',
    'upgraded','downgraded','renewed','canceled','reactivated','payment_failed'
  )),
  from_plan_code TEXT,
  to_plan_code TEXT,
  provider TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscription_events TO authenticated;
GRANT ALL    ON public.subscription_events TO service_role;

ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscription_events_read_own_org"
  ON public.subscription_events FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());

-- Escrita somente via service_role (server functions), sem policy p/ authenticated.

CREATE INDEX IF NOT EXISTS idx_subscription_events_org_created
  ON public.subscription_events (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscription_events_subscription
  ON public.subscription_events (subscription_id);

-- 3) subscriptions — colunas aditivas ------------------------
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.plans(id),
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id
  ON public.subscriptions (plan_id);

-- 4) Seed inicial do catálogo --------------------------------
INSERT INTO public.plans (code, name, description, price_cents, currency, interval, trial_days, features, limits, active, sort_order)
VALUES
  ('trial',      'Trial',      'Período gratuito de avaliação',    0,     'BRL', 'month', 15,
    '{"whatsapp":true,"financeiro":true,"leads":true}'::jsonb,
    '{"leads":100,"instancias_whatsapp":1}'::jsonb, true, 0),
  ('basico',     'Básico',     'Para pequenas operações',        2999,   'BRL', 'month', 0,
    '{"whatsapp":true,"financeiro":true,"sigma":true,"leads_ilimitados":true}'::jsonb,
    '{"leads":-1,"instancias_whatsapp":2}'::jsonb, true, 10),
  ('completo',   'Completo',   'Aquisição paga + IA + automações', 6999, 'BRL', 'month', 0,
    '{"whatsapp":true,"financeiro":true,"sigma":true,"meta_ads":true,"google_ads":true,"copiloto_ia":true,"automacoes":true,"tickets":true}'::jsonb,
    '{"leads":-1,"instancias_whatsapp":5,"campanhas":-1}'::jsonb, true, 20),
  ('enterprise', 'Enterprise', 'Contratos B2B com SSO e SLA',    29900,   'BRL', 'month', 0,
    '{"whatsapp":true,"financeiro":true,"sigma":true,"meta_ads":true,"google_ads":true,"copiloto_ia":true,"automacoes":true,"tickets":true,"sso":true,"white_label":true,"api_publica":true}'::jsonb,
    '{"leads":-1,"instancias_whatsapp":-1,"campanhas":-1,"seats":-1}'::jsonb, true, 30)
ON CONFLICT (code) DO NOTHING;
