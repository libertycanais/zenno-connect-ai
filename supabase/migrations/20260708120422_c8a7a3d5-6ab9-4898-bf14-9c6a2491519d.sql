-- Sprint 3.5 — Tracking Security Hardening
-- 1) Normalize already stored tracking origins: lowercase, remove protocols/paths, remove empty entries and duplicates.
UPDATE public.organizations o
SET tracking_allowed_origins = COALESCE(n.normalized, ARRAY[]::text[])
FROM (
  SELECT
    id,
    ARRAY(
      SELECT DISTINCT cleaned
      FROM unnest(COALESCE(tracking_allowed_origins, ARRAY[]::text[])) AS raw_origin,
      LATERAL (
        SELECT NULLIF(regexp_replace(regexp_replace(lower(trim(raw_origin)), '^https?://', ''), '/.*$', ''), '') AS cleaned
      ) s
      WHERE cleaned IS NOT NULL
        AND cleaned ~ '^(\*\.)?[a-z0-9.-]+\.[a-z]{2,}$'
      ORDER BY cleaned
    ) AS normalized
  FROM public.organizations
) n
WHERE o.id = n.id;

ALTER TABLE public.organizations
  ALTER COLUMN tracking_allowed_origins SET DEFAULT ARRAY[]::text[],
  ALTER COLUMN tracking_allowed_origins SET NOT NULL;

COMMENT ON COLUMN public.organizations.tracking_allowed_origins IS
  'Fail-closed public tracking allowlist. Empty array means public tracking requests are rejected.';

-- 2) Strengthen the tracking limiter to support compound keys without breaking the existing signature.
CREATE OR REPLACE FUNCTION public.track_rate_limit_hit(
  _org uuid,
  _ip text,
  _max integer,
  _window_seconds integer DEFAULT 60,
  _key text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  _bucket timestamptz;
  _count integer;
  _effective_ip text;
BEGIN
  _bucket := to_timestamp(floor(extract(epoch from now()) / greatest(_window_seconds, 1)) * greatest(_window_seconds, 1));
  _effective_ip := coalesce(nullif(_key, ''), coalesce(nullif(_ip, ''), 'unknown'));

  INSERT INTO public.tracking_rate_limits (organization_id, ip, bucket, count)
    VALUES (_org, _effective_ip, _bucket, 1)
    ON CONFLICT (organization_id, ip, bucket)
    DO UPDATE SET count = public.tracking_rate_limits.count + 1
    RETURNING count INTO _count;

  DELETE FROM public.tracking_rate_limits
  WHERE bucket < now() - interval '10 minutes';

  RETURN _count > _max;
END;
$$;

REVOKE ALL ON FUNCTION public.track_rate_limit_hit(uuid, text, integer, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_rate_limit_hit(uuid, text, integer, integer, text) TO service_role;

COMMENT ON FUNCTION public.track_rate_limit_hit(uuid, text, integer, integer, text) IS
  'Atomic fail-closed tracking limiter. Optional key supports compound org+ip+public-key buckets while preserving legacy callers.';

-- Preserve explicit privileges on the previous callable signature as well.
REVOKE ALL ON FUNCTION public.track_rate_limit_hit(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_rate_limit_hit(uuid, text, integer, integer) TO service_role;

-- 3) Add append-only audit triggers to public conversion queues/tables.
DO $$
DECLARE
  t text;
  monitored text[] := ARRAY[
    'meta_conversion_events',
    'google_ads_conversions'
  ];
BEGIN
  FOREACH t IN ARRAY monitored LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON public.%1$I;', t);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s
         AFTER INSERT OR UPDATE OR DELETE ON public.%1$I
         FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();',
      t
    );
  END LOOP;
END $$;

COMMENT ON TRIGGER trg_audit_meta_conversion_events ON public.meta_conversion_events IS
  'Audits public tracking-originated Meta conversion records with automatic sensitive-field redaction.';
COMMENT ON TRIGGER trg_audit_google_ads_conversions ON public.google_ads_conversions IS
  'Audits public tracking-originated Google Ads conversion records with automatic sensitive-field redaction.';