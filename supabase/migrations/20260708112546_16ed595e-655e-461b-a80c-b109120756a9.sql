
-- Enable + force RLS on all existing audit_log partitions
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_inherits i
    JOIN pg_class c   ON c.oid = i.inhrelid
    JOIN pg_class p   ON p.oid = i.inhparent
    JOIN pg_namespace n ON n.oid = p.relnamespace
    WHERE p.relname = 'audit_log' AND n.nspname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.relname);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;',  r.relname);
  END LOOP;
END $$;

-- Also force on the parent so service_role writes still respect it (writer is SECURITY DEFINER; safe)
ALTER TABLE public.audit_log FORCE ROW LEVEL SECURITY;

-- Reusable helper for future partition provisioning
CREATE OR REPLACE FUNCTION public.audit_log_ensure_partition(_month DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  m_start DATE := date_trunc('month', _month)::date;
  m_end   DATE := (m_start + INTERVAL '1 month')::date;
  part    TEXT := format('audit_log_%s', to_char(m_start, 'YYYY_MM'));
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.audit_log
       FOR VALUES FROM (%L) TO (%L);', part, m_start::text, m_end::text);
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', part);
  EXECUTE format('ALTER TABLE public.%I FORCE  ROW LEVEL SECURITY;', part);
END;
$$;

REVOKE ALL ON FUNCTION public.audit_log_ensure_partition(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_log_ensure_partition(DATE) TO service_role;
