
-- =========================================================================
-- FASE 3: SECURITY DEFINER HARDENING — fixed search_path (pg_catalog, public)
-- Logic preserved verbatim; only SET search_path is changed.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role AND organization_id = _org_id
  )
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  new_org_id UUID;
  org_name TEXT;
BEGIN
  org_name := COALESCE(NEW.raw_user_meta_data->>'organization_name', split_part(NEW.email,'@',1) || '''s Org');
  INSERT INTO public.organizations(name) VALUES (org_name) RETURNING id INTO new_org_id;
  INSERT INTO public.profiles(id, organization_id, full_name, email)
    VALUES (NEW.id, new_org_id, NEW.raw_user_meta_data->>'full_name', NEW.email);
  INSERT INTO public.user_roles(user_id, organization_id, role)
    VALUES (NEW.id, new_org_id, 'owner');
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_default_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  INSERT INTO public.subscriptions (organization_id, plan, status, trial_ends_at)
  VALUES (NEW.id, 'trial', 'trialing', now() + interval '15 days')
  ON CONFLICT (organization_id) DO NOTHING;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.track_rate_limit_hit(_org uuid, _ip text, _max integer, _window_seconds integer DEFAULT 60)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  _bucket timestamptz;
  _count int;
BEGIN
  _bucket := date_trunc('minute', now());
  INSERT INTO public.tracking_rate_limits (organization_id, ip, bucket, count)
    VALUES (_org, coalesce(_ip, 'unknown'), _bucket, 1)
    ON CONFLICT (organization_id, ip, bucket)
    DO UPDATE SET count = tracking_rate_limits.count + 1
    RETURNING count INTO _count;
  DELETE FROM public.tracking_rate_limits WHERE bucket < now() - interval '10 minutes';
  RETURN _count > _max;
END;
$function$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END $function$;
