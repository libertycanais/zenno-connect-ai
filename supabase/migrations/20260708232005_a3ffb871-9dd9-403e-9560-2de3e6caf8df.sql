-- Sprint 5.2 — Performance Optimization (additive only)
-- Respects Architecture Freeze v1.0: no schema, RLS, or contract changes.

-- 1) High priority index: tracking_leads (organization_id, lead_id) — accelerates
--    the attribution join in src/lib/attributed-leads.functions.ts.
CREATE INDEX IF NOT EXISTS tracking_leads_org_lead_idx
  ON public.tracking_leads (organization_id, lead_id)
  WHERE lead_id IS NOT NULL;

-- 2) Critical: audit_log partition retention helper.
--    Drops partitions whose entire month window is older than _keep_months.
--    Idempotent, safe to schedule via cron. Does not touch current data.
CREATE OR REPLACE FUNCTION public.audit_log_prune_partitions(_keep_months integer DEFAULT 12)
RETURNS TABLE(dropped_partition text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  _cutoff date := (date_trunc('month', now()) - make_interval(months => GREATEST(_keep_months, 1)))::date;
  _rec    record;
  _from   date;
BEGIN
  FOR _rec IN
    SELECT c.relname AS part_name,
           pg_get_expr(c.relpartbound, c.oid) AS bound_expr
    FROM   pg_inherits i
    JOIN   pg_class    c  ON c.oid = i.inhrelid
    JOIN   pg_class    p  ON p.oid = i.inhparent
    JOIN   pg_namespace n ON n.oid = p.relnamespace
    WHERE  n.nspname = 'public'
      AND  p.relname = 'audit_log'
  LOOP
    -- Bound looks like: FOR VALUES FROM ('2026-07-01') TO ('2026-08-01')
    BEGIN
      _from := (regexp_match(_rec.bound_expr, 'FROM \(''([0-9\-]+)''\)'))[1]::date;
    EXCEPTION WHEN others THEN
      CONTINUE;
    END;

    IF _from < _cutoff THEN
      EXECUTE format('DROP TABLE IF EXISTS public.%I', _rec.part_name);
      dropped_partition := _rec.part_name;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_log_prune_partitions(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_log_prune_partitions(integer) TO service_role;

COMMENT ON FUNCTION public.audit_log_prune_partitions(integer) IS
  'Sprint 5.2: drops audit_log partitions older than _keep_months (default 12). Service-role only.';
