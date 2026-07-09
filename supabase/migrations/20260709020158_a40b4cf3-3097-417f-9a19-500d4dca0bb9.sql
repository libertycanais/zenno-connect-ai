
-- =====================================================================
-- FEATURE P0.6 — Zenno AI Copilot Enterprise · Onda 1 (Fundação)
-- Additive migration: creates task engine + AI infrastructure tables.
-- All tables: organization_id NOT NULL, RLS default-deny, triggers, grants.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) TASKS — generic task engine
-- ---------------------------------------------------------------------
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  parent_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  conversation_id UUID,
  type TEXT NOT NULL CHECK (type IN ('AI','SYNC','IMPORT','EXPORT','AUTOMATION','REPORT','BILLING','AUDIT')),
  category TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','succeeded','failed','cancelled','timeout')),
  priority SMALLINT NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  provider TEXT,
  model TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  tokens_in INTEGER NOT NULL DEFAULT 0 CHECK (tokens_in >= 0),
  tokens_out INTEGER NOT NULL DEFAULT 0 CHECK (tokens_out >= 0),
  estimated_cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (estimated_cost_cents >= 0),
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  error_code TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_org_created ON public.tasks (organization_id, created_at DESC);
CREATE INDEX idx_tasks_org_status ON public.tasks (organization_id, status);
CREATE INDEX idx_tasks_org_type ON public.tasks (organization_id, type);
CREATE INDEX idx_tasks_conversation ON public.tasks (conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX idx_tasks_parent ON public.tasks (parent_task_id) WHERE parent_task_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks FORCE ROW LEVEL SECURITY;

CREATE POLICY tasks_select_own_org ON public.tasks
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());

CREATE POLICY tasks_insert_own_org ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_org_id()
    AND (user_id IS NULL OR user_id = auth.uid())
  );

CREATE POLICY tasks_update_own_org ON public.tasks
  FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());

CREATE POLICY tasks_delete_admin ON public.tasks
  FOR DELETE TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND (
      public.has_role(auth.uid(), 'owner'::app_role, organization_id)
      OR public.has_role(auth.uid(), 'admin'::app_role, organization_id)
    )
  );

CREATE TRIGGER trg_tasks_touch_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_tasks_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- ---------------------------------------------------------------------
-- 2) AI_CONVERSATIONS
-- ---------------------------------------------------------------------
CREATE TABLE public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nova conversa',
  agent TEXT,
  provider TEXT,
  model TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','archived','deleted')),
  message_count INTEGER NOT NULL DEFAULT 0 CHECK (message_count >= 0),
  task_count INTEGER NOT NULL DEFAULT 0 CHECK (task_count >= 0),
  total_tokens INTEGER NOT NULL DEFAULT 0 CHECK (total_tokens >= 0),
  total_cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (total_cost_cents >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_conv_org_updated ON public.ai_conversations (organization_id, updated_at DESC);
CREATE INDEX idx_ai_conv_user ON public.ai_conversations (user_id, updated_at DESC);
CREATE INDEX idx_ai_conv_status ON public.ai_conversations (organization_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated;
GRANT ALL ON public.ai_conversations TO service_role;

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations FORCE ROW LEVEL SECURITY;

CREATE POLICY ai_conv_select_own_org ON public.ai_conversations
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());

CREATE POLICY ai_conv_insert_self ON public.ai_conversations
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id() AND user_id = auth.uid());

CREATE POLICY ai_conv_update_own ON public.ai_conversations
  FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id() AND user_id = auth.uid())
  WITH CHECK (organization_id = public.current_org_id() AND user_id = auth.uid());

CREATE POLICY ai_conv_delete_own ON public.ai_conversations
  FOR DELETE TO authenticated
  USING (organization_id = public.current_org_id() AND user_id = auth.uid());

CREATE TRIGGER trg_ai_conv_touch_updated_at
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_ai_conv_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.ai_conversations
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- FK for tasks.conversation_id -> ai_conversations.id (created after ai_conversations exists)
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_conversation_fk
  FOREIGN KEY (conversation_id) REFERENCES public.ai_conversations(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------
-- 3) AI_MESSAGES
-- ---------------------------------------------------------------------
CREATE TABLE public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('system','user','assistant','tool')),
  content TEXT NOT NULL,
  tokens_in INTEGER NOT NULL DEFAULT 0 CHECK (tokens_in >= 0),
  tokens_out INTEGER NOT NULL DEFAULT 0 CHECK (tokens_out >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_msg_conv ON public.ai_messages (conversation_id, created_at);
CREATE INDEX idx_ai_msg_org ON public.ai_messages (organization_id, created_at DESC);
CREATE INDEX idx_ai_msg_task ON public.ai_messages (task_id) WHERE task_id IS NOT NULL;

GRANT SELECT, INSERT, DELETE ON public.ai_messages TO authenticated;
GRANT ALL ON public.ai_messages TO service_role;

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages FORCE ROW LEVEL SECURITY;

CREATE POLICY ai_msg_select_own_org ON public.ai_messages
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());

CREATE POLICY ai_msg_insert_own_org ON public.ai_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_org_id()
    AND EXISTS (
      SELECT 1 FROM public.ai_conversations c
      WHERE c.id = conversation_id
        AND c.organization_id = public.current_org_id()
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY ai_msg_delete_own_org ON public.ai_messages
  FOR DELETE TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND EXISTS (
      SELECT 1 FROM public.ai_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

CREATE TRIGGER trg_ai_msg_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.ai_messages
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- ---------------------------------------------------------------------
-- 4) AI_PROVIDER_CREDENTIALS
--   API key is stored encrypted (application-level AEAD) as BYTEA.
--   Only fingerprint + last4 may be exposed to the frontend.
--   Audit trigger is NOT attached to avoid any risk of leaking the key.
-- ---------------------------------------------------------------------
CREATE TABLE public.ai_provider_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('openai','anthropic','google','groq','deepseek','xai','lovable')),
  label TEXT,
  default_model TEXT,
  temperature NUMERIC(3,2) NOT NULL DEFAULT 0.20 CHECK (temperature >= 0 AND temperature <= 2),
  max_tokens INTEGER NOT NULL DEFAULT 4096 CHECK (max_tokens > 0 AND max_tokens <= 200000),
  timeout_ms INTEGER NOT NULL DEFAULT 30000 CHECK (timeout_ms >= 1000 AND timeout_ms <= 120000),
  api_key_ciphertext BYTEA NOT NULL,
  api_key_nonce BYTEA NOT NULL,
  api_key_fingerprint TEXT NOT NULL,
  api_key_last4 TEXT NOT NULL CHECK (char_length(api_key_last4) <= 8),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, provider, api_key_fingerprint)
);

CREATE INDEX idx_ai_cred_org_provider ON public.ai_provider_credentials (organization_id, provider);
CREATE INDEX idx_ai_cred_org_active ON public.ai_provider_credentials (organization_id) WHERE is_active;

-- NOTE: authenticated users can SELECT metadata columns via a VIEW; the base table
-- restricts SELECT so the encrypted key never leaks even by mistake.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_provider_credentials TO service_role;
GRANT ALL ON public.ai_provider_credentials TO service_role;

ALTER TABLE public.ai_provider_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_provider_credentials FORCE ROW LEVEL SECURITY;

-- Only owners/admins of the org may manage credentials, and even they must go
-- through the safe view for reads. No direct SELECT is granted to authenticated.
CREATE POLICY ai_cred_admin_all ON public.ai_provider_credentials
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND (
      public.has_role(auth.uid(), 'owner'::app_role, organization_id)
      OR public.has_role(auth.uid(), 'admin'::app_role, organization_id)
    )
  )
  WITH CHECK (
    organization_id = public.current_org_id()
    AND (
      public.has_role(auth.uid(), 'owner'::app_role, organization_id)
      OR public.has_role(auth.uid(), 'admin'::app_role, organization_id)
    )
  );

CREATE TRIGGER trg_ai_cred_touch_updated_at
  BEFORE UPDATE ON public.ai_provider_credentials
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Safe view: exposes only non-secret columns. Frontends read from this view.
CREATE VIEW public.ai_provider_credentials_safe
WITH (security_invoker = true)
AS
SELECT
  id,
  organization_id,
  provider,
  label,
  default_model,
  temperature,
  max_tokens,
  timeout_ms,
  api_key_fingerprint,
  api_key_last4,
  is_active,
  last_used_at,
  created_by,
  created_at,
  updated_at
FROM public.ai_provider_credentials;

GRANT SELECT ON public.ai_provider_credentials_safe TO authenticated;
GRANT SELECT ON public.ai_provider_credentials_safe TO service_role;

-- ---------------------------------------------------------------------
-- 5) AI_USAGE — per-call usage log
-- ---------------------------------------------------------------------
CREATE TABLE public.ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  tokens_in INTEGER NOT NULL DEFAULT 0 CHECK (tokens_in >= 0),
  tokens_out INTEGER NOT NULL DEFAULT 0 CHECK (tokens_out >= 0),
  latency_ms INTEGER NOT NULL DEFAULT 0 CHECK (latency_ms >= 0),
  cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (cost_cents >= 0),
  status TEXT NOT NULL CHECK (status IN ('success','error','timeout','blocked')),
  error_code TEXT,
  request_id TEXT,
  trace_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_usage_org_created ON public.ai_usage (organization_id, created_at DESC);
CREATE INDEX idx_ai_usage_org_provider ON public.ai_usage (organization_id, provider, created_at DESC);
CREATE INDEX idx_ai_usage_task ON public.ai_usage (task_id) WHERE task_id IS NOT NULL;

GRANT SELECT ON public.ai_usage TO authenticated;
GRANT ALL ON public.ai_usage TO service_role;

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage FORCE ROW LEVEL SECURITY;

CREATE POLICY ai_usage_select_own_org ON public.ai_usage
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
-- INSERT is server-side only (service_role) via orchestrator.

-- ---------------------------------------------------------------------
-- 6) AI_MEMORY — long-lived org-scoped memory
-- ---------------------------------------------------------------------
CREATE TABLE public.ai_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN (
    'objectives','products','competitors','preferences','restrictions',
    'campaigns','history','insights','custom'
  )),
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC(3,2) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  source TEXT,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, scope, key)
);

CREATE INDEX idx_ai_memory_org_scope ON public.ai_memory (organization_id, scope);
CREATE INDEX idx_ai_memory_pinned ON public.ai_memory (organization_id) WHERE is_pinned;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_memory TO authenticated;
GRANT ALL ON public.ai_memory TO service_role;

ALTER TABLE public.ai_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_memory FORCE ROW LEVEL SECURITY;

CREATE POLICY ai_memory_select_own_org ON public.ai_memory
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());

CREATE POLICY ai_memory_write_admin ON public.ai_memory
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND (
      public.has_role(auth.uid(), 'owner'::app_role, organization_id)
      OR public.has_role(auth.uid(), 'admin'::app_role, organization_id)
    )
  )
  WITH CHECK (
    organization_id = public.current_org_id()
    AND (
      public.has_role(auth.uid(), 'owner'::app_role, organization_id)
      OR public.has_role(auth.uid(), 'admin'::app_role, organization_id)
    )
  );

CREATE TRIGGER trg_ai_memory_touch_updated_at
  BEFORE UPDATE ON public.ai_memory
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_ai_memory_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.ai_memory
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- ---------------------------------------------------------------------
-- 7) AI_CONTEXT_CACHE — short-lived context cache with TTL
-- ---------------------------------------------------------------------
CREATE TABLE public.ai_context_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  cache_key TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'default',
  payload JSONB NOT NULL,
  ttl_seconds INTEGER NOT NULL DEFAULT 300 CHECK (ttl_seconds > 0 AND ttl_seconds <= 86400),
  expires_at TIMESTAMPTZ NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0 CHECK (hit_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, scope, cache_key)
);

CREATE INDEX idx_ai_cache_org_key ON public.ai_context_cache (organization_id, scope, cache_key);
CREATE INDEX idx_ai_cache_expires ON public.ai_context_cache (expires_at);

GRANT SELECT ON public.ai_context_cache TO authenticated;
GRANT ALL ON public.ai_context_cache TO service_role;

ALTER TABLE public.ai_context_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_context_cache FORCE ROW LEVEL SECURITY;

CREATE POLICY ai_cache_select_own_org ON public.ai_context_cache
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
-- INSERT/UPDATE/DELETE via service_role only (orchestrator).

CREATE TRIGGER trg_ai_cache_touch_updated_at
  BEFORE UPDATE ON public.ai_context_cache
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 8) Extend audit_redact with AI-specific keys
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_redact(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  out_json JSONB := payload;
  redact_keys TEXT[] := ARRAY[
    'access_token','refresh_token','token','api_key','apikey',
    'secret','password','password_hash','client_secret',
    'webhook_secret','service_role_key','authorization','cookie',
    -- AI-specific keys added in P0.6
    'api_key_ciphertext','api_key_nonce','api_key_plaintext',
    'openai_api_key','anthropic_api_key','google_api_key',
    'groq_api_key','deepseek_api_key','xai_api_key'
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
$function$;

-- ---------------------------------------------------------------------
-- 9) Cache cleanup helper (called by orchestrator opportunistically)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ai_context_cache_cleanup()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  _deleted INTEGER;
BEGIN
  DELETE FROM public.ai_context_cache WHERE expires_at < now();
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RETURN _deleted;
END;
$function$;

REVOKE ALL ON FUNCTION public.ai_context_cache_cleanup() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ai_context_cache_cleanup() TO service_role;
