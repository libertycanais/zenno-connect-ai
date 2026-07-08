-- Sprint 3.5 corrective hardening — avoid overloaded RPC ambiguity.
DROP FUNCTION IF EXISTS public.track_rate_limit_hit(uuid, text, integer, integer, text);

CREATE OR REPLACE FUNCTION public.track_compound_rate_limit_hit(
  _org uuid,
  _key text,
  _max integer,
  _window_seconds integer DEFAULT 60
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  _bucket timestamptz;
  _count integer;
  _effective_key text;
BEGIN
  _bucket := to_timestamp(floor(extract(epoch from now()) / greatest(_window_seconds, 1)) * greatest(_window_seconds, 1));
  _effective_key := coalesce(nullif(_key, ''), 'unknown');

  INSERT INTO public.tracking_rate_limits (organization_id, ip, bucket, count)
    VALUES (_org, _effective_key, _bucket, 1)
    ON CONFLICT (organization_id, ip, bucket)
    DO UPDATE SET count = public.tracking_rate_limits.count + 1
    RETURNING count INTO _count;

  DELETE FROM public.tracking_rate_limits
  WHERE bucket < now() - interval '10 minutes';

  RETURN _count > _max;
END;
$$;

REVOKE ALL ON FUNCTION public.track_compound_rate_limit_hit(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_compound_rate_limit_hit(uuid, text, integer, integer) TO service_role;

COMMENT ON FUNCTION public.track_compound_rate_limit_hit(uuid, text, integer, integer) IS
  'Atomic tracking limiter for compound public endpoint keys such as org+public-key+ip and org+public-key.';