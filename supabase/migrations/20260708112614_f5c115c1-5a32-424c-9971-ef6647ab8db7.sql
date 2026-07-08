
-- =========================================================================
-- FASE 2: GLOBAL RATE LIMIT
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.global_rate_limits (
  key            TEXT        NOT NULL,
  window_start   TIMESTAMPTZ NOT NULL,
  count          INTEGER     NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_global_rate_limits_window
  ON public.global_rate_limits (window_start);

-- No app-level access; only the SECURITY DEFINER function reads/writes
REVOKE ALL ON public.global_rate_limits FROM PUBLIC, anon, authenticated;
GRANT  ALL ON public.global_rate_limits TO service_role;

ALTER TABLE public.global_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_rate_limits FORCE  ROW LEVEL SECURITY;
-- no policies => authenticated/anon get nothing; service_role bypasses when needed

CREATE OR REPLACE FUNCTION public.global_rate_limit_hit(
  _key TEXT,
  _limit INTEGER,
  _window_seconds INTEGER DEFAULT 60
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  _bucket TIMESTAMPTZ;
  _count  INTEGER;
BEGIN
  IF _key IS NULL OR length(_key) = 0 THEN
    RETURN false;
  END IF;
  IF _window_seconds IS NULL OR _window_seconds <= 0 THEN
    _window_seconds := 60;
  END IF;

  -- align bucket to window
  _bucket := to_timestamp(floor(extract(epoch FROM now()) / _window_seconds) * _window_seconds);

  INSERT INTO public.global_rate_limits (key, window_start, count)
    VALUES (_key, _bucket, 1)
    ON CONFLICT (key, window_start)
    DO UPDATE SET count = public.global_rate_limits.count + 1
    RETURNING count INTO _count;

  -- best-effort cleanup: drop windows older than 1h
  DELETE FROM public.global_rate_limits
    WHERE window_start < now() - INTERVAL '1 hour';

  RETURN _count > _limit;
END;
$$;

REVOKE ALL ON FUNCTION public.global_rate_limit_hit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.global_rate_limit_hit(TEXT, INTEGER, INTEGER) TO service_role;

COMMENT ON FUNCTION public.global_rate_limit_hit(TEXT, INTEGER, INTEGER) IS
  'Generic rate limiter. Returns true when the caller has EXCEEDED the limit within the window. Callers: OAuth callbacks, webhooks, integration creation, login.';
