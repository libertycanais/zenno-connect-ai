
-- =========================================================================
-- FASE 1: AUDIT LOG ENTERPRISE (append-only, partitioned by month)
-- =========================================================================

-- 1) Parent partitioned table
CREATE TABLE IF NOT EXISTS public.audit_log (
  id             UUID        NOT NULL DEFAULT gen_random_uuid(),
  actor_user_id  UUID        NULL,
  actor_org_id   UUID        NULL,
  request_id     TEXT        NULL,
  trace_id       TEXT        NULL,
  ip             TEXT        NULL,
  user_agent     TEXT        NULL,
  action         TEXT        NOT NULL,
  entity_type    TEXT        NOT NULL,
  entity_id      TEXT        NULL,
  old_data       JSONB       NULL,
  new_data       JSONB       NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- 2) Indexes on parent (propagate to partitions)
CREATE INDEX IF NOT EXISTS idx_audit_log_org_created
  ON public.audit_log (actor_org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity
  ON public.audit_log (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_request
  ON public.audit_log (request_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action_created
  ON public.audit_log (action, created_at DESC);

-- 3) Auto-provision partitions (current month + next 12 months)
DO $$
DECLARE
  m_start DATE := date_trunc('month', now())::date;
  m       DATE;
  part    TEXT;
  next_m  DATE;
BEGIN
  FOR i IN 0..12 LOOP
    m       := (m_start + (i || ' months')::interval)::date;
    next_m  := (m + INTERVAL '1 month')::date;
    part    := format('audit_log_%s', to_char(m, 'YYYY_MM'));
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.audit_log
         FOR VALUES FROM (%L) TO (%L);',
      part, m::text, next_m::text
    );
  END LOOP;
END $$;

-- 4) Grants — leitura via authenticated (filtrada por RLS); escrita nunca direta
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL   ON public.audit_log TO service_role;

-- 5) RLS: read only for own organization; NO insert/update/delete policies
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_select_own_org" ON public.audit_log;
CREATE POLICY "audit_log_select_own_org"
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (actor_org_id = public.current_org_id());

-- 6) Prevent UPDATE/DELETE at the trigger level (defense-in-depth vs. service_role)
CREATE OR REPLACE FUNCTION public.audit_log_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only (% blocked)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS audit_log_no_update ON public.audit_log;
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_block_mutation();

DROP TRIGGER IF EXISTS audit_log_no_delete ON public.audit_log;
CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_block_mutation();

-- 7) Redaction helper — strip secret-like fields from JSONB payloads
CREATE OR REPLACE FUNCTION public.audit_redact(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  out_json JSONB := payload;
  redact_keys TEXT[] := ARRAY[
    'access_token','refresh_token','token','api_key','apikey',
    'secret','password','password_hash','client_secret',
    'webhook_secret','service_role_key','authorization','cookie'
  ];
  k TEXT;
BEGIN
  IF out_json IS NULL THEN
    RETURN NULL;
  END IF;
  FOREACH k IN ARRAY redact_keys LOOP
    IF out_json ? k THEN
      out_json := jsonb_set(out_json, ARRAY[k], to_jsonb('[REDACTED]'::text), false);
    END IF;
  END LOOP;
  RETURN out_json;
END;
$$;

-- 8) Central writer — SECURITY DEFINER, only path to insert audit rows
CREATE OR REPLACE FUNCTION public.app_write_audit_log(
  _actor_user_id UUID,
  _actor_org_id  UUID,
  _action        TEXT,
  _entity_type   TEXT,
  _entity_id     TEXT,
  _old_data      JSONB DEFAULT NULL,
  _new_data      JSONB DEFAULT NULL,
  _request_id    TEXT  DEFAULT NULL,
  _trace_id      TEXT  DEFAULT NULL,
  _ip            TEXT  DEFAULT NULL,
  _user_agent    TEXT  DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  _id UUID := gen_random_uuid();
BEGIN
  INSERT INTO public.audit_log (
    id, actor_user_id, actor_org_id, request_id, trace_id,
    ip, user_agent, action, entity_type, entity_id, old_data, new_data
  ) VALUES (
    _id, _actor_user_id, _actor_org_id, _request_id, _trace_id,
    _ip, _user_agent, _action, _entity_type, _entity_id,
    public.audit_redact(_old_data), public.audit_redact(_new_data)
  );
  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.app_write_audit_log(
  UUID,UUID,TEXT,TEXT,TEXT,JSONB,JSONB,TEXT,TEXT,TEXT,TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_write_audit_log(
  UUID,UUID,TEXT,TEXT,TEXT,JSONB,JSONB,TEXT,TEXT,TEXT,TEXT
) TO service_role;

-- 9) Generic trigger — writes audit rows on INSERT/UPDATE/DELETE
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  _org_id     UUID;
  _entity_id  TEXT;
  _actor      UUID := auth.uid();
  _old        JSONB;
  _new        JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _old := to_jsonb(OLD);
    _entity_id := COALESCE((_old->>'id'), NULL);
    _org_id := NULLIF(_old->>'organization_id','')::uuid;
  ELSIF TG_OP = 'INSERT' THEN
    _new := to_jsonb(NEW);
    _entity_id := COALESCE((_new->>'id'), NULL);
    _org_id := NULLIF(_new->>'organization_id','')::uuid;
  ELSE -- UPDATE
    _old := to_jsonb(OLD);
    _new := to_jsonb(NEW);
    _entity_id := COALESCE((_new->>'id'), (_old->>'id'), NULL);
    _org_id := COALESCE(
      NULLIF(_new->>'organization_id','')::uuid,
      NULLIF(_old->>'organization_id','')::uuid
    );
  END IF;

  -- organizations table: entity id IS the org id
  IF TG_TABLE_NAME = 'organizations' THEN
    _org_id := COALESCE(_org_id, _entity_id::uuid);
  END IF;

  PERFORM public.app_write_audit_log(
    _actor,
    _org_id,
    TG_OP || ':' || TG_TABLE_NAME,
    TG_TABLE_NAME,
    _entity_id,
    public.audit_redact(_old),
    public.audit_redact(_new),
    NULL, NULL, NULL, NULL
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_row_change() FROM PUBLIC;

-- 10) Attach triggers to monitored tables (idempotent)
DO $$
DECLARE
  t TEXT;
  monitored TEXT[] := ARRAY[
    'user_roles',
    'payment_integrations',
    'meta_ad_accounts',
    'google_ad_accounts',
    'whatsapp_instances',
    'sigma_integrations',
    'organizations'
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

COMMENT ON TABLE public.audit_log IS
  'Append-only enterprise audit trail. Partitioned monthly, 18-month retention target. Writes only via app_write_audit_log() / audit_row_change().';
