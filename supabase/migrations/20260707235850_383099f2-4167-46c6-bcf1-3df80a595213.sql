
-- Allowlist de origens por organização (para o pixel público)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS tracking_allowed_origins text[] NOT NULL DEFAULT '{}';

-- Rate limit por (org, ip, janela de 1 min)
CREATE TABLE IF NOT EXISTS public.tracking_rate_limits (
  organization_id uuid NOT NULL,
  ip text NOT NULL,
  bucket timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (organization_id, ip, bucket)
);

GRANT ALL ON public.tracking_rate_limits TO service_role;
ALTER TABLE public.tracking_rate_limits ENABLE ROW LEVEL SECURITY;
-- sem policies: só service_role acessa

-- Função atômica de rate limit: retorna true se estourou o limite
CREATE OR REPLACE FUNCTION public.track_rate_limit_hit(
  _org uuid, _ip text, _max int, _window_seconds int DEFAULT 60
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  -- limpa buckets antigos (best-effort)
  DELETE FROM public.tracking_rate_limits WHERE bucket < now() - interval '10 minutes';
  RETURN _count > _max;
END;
$$;

REVOKE ALL ON FUNCTION public.track_rate_limit_hit(uuid, text, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_rate_limit_hit(uuid, text, int, int) TO service_role;
