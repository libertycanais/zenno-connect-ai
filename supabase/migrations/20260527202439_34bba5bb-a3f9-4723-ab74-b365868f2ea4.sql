CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'trial' CHECK (plan IN ('trial','basico','completo','cancelado')),
  status text NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing','active','past_due','cancelled')),
  trial_ends_at timestamptz NOT NULL DEFAULT (now() + interval '15 days'),
  current_period_end timestamptz,
  price_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read subscription" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (organization_id = app_private.current_org_id());

CREATE POLICY "admins update subscription" ON public.subscriptions
  FOR UPDATE TO authenticated
  USING (organization_id = app_private.current_org_id()
    AND (app_private.has_role(auth.uid(),'owner'::app_role, organization_id)
      OR app_private.has_role(auth.uid(),'admin'::app_role, organization_id)));

CREATE POLICY "admins insert subscription" ON public.subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = app_private.current_org_id()
    AND (app_private.has_role(auth.uid(),'owner'::app_role, organization_id)
      OR app_private.has_role(auth.uid(),'admin'::app_role, organization_id)));

CREATE TRIGGER trg_subscriptions_updated
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-create trial subscription for every new organization
CREATE OR REPLACE FUNCTION public.create_default_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.subscriptions (organization_id, plan, status, trial_ends_at)
  VALUES (NEW.id, 'trial', 'trialing', now() + interval '15 days')
  ON CONFLICT (organization_id) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_org_default_subscription
AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.create_default_subscription();

-- Backfill existing organizations
INSERT INTO public.subscriptions (organization_id, plan, status, trial_ends_at)
SELECT id, 'trial', 'trialing', now() + interval '15 days'
FROM public.organizations
ON CONFLICT (organization_id) DO NOTHING;