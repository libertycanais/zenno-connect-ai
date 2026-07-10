
-- ============================================================================
-- FEATURE: Enterprise Marketing Platform Connector v1.0 (Fase 2 Build)
-- 100% aditivo. Não altera tabelas existentes. RLS org-scoped + FORCE RLS.
-- ============================================================================

-- 1) marketing_connections ---------------------------------------------------
CREATE TABLE public.marketing_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google','meta','tiktok','linkedin','microsoft')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','error','revoked','expired')),
  display_name TEXT,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  credentials_ciphertext TEXT,
  credentials_nonce TEXT,
  refresh_ciphertext TEXT,
  refresh_nonce TEXT,
  token_expires_at TIMESTAMPTZ,
  last_health_score INTEGER,
  last_health_status TEXT,
  last_health_at TIMESTAMPTZ,
  last_error TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  connected_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, provider, display_name)
);
CREATE INDEX idx_mkt_conn_org ON public.marketing_connections(organization_id);
CREATE INDEX idx_mkt_conn_provider ON public.marketing_connections(organization_id, provider);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_connections TO authenticated;
GRANT ALL ON public.marketing_connections TO service_role;
ALTER TABLE public.marketing_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_connections FORCE ROW LEVEL SECURITY;
CREATE POLICY mkt_conn_org_select ON public.marketing_connections FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
CREATE POLICY mkt_conn_org_write ON public.marketing_connections FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());
CREATE TRIGGER trg_mkt_conn_touch BEFORE UPDATE ON public.marketing_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_mkt_conn_audit AFTER INSERT OR UPDATE OR DELETE ON public.marketing_connections
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- 2) marketing_assets --------------------------------------------------------
CREATE TABLE public.marketing_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.marketing_connections(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  asset_kind TEXT NOT NULL,
  external_id TEXT NOT NULL,
  parent_external_id TEXT,
  name TEXT,
  currency TEXT,
  timezone TEXT,
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  health_score INTEGER NOT NULL DEFAULT 0,
  health_status TEXT NOT NULL DEFAULT 'unknown' CHECK (health_status IN ('online','warning','offline','unknown')),
  health_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_synced_at TIMESTAMPTZ,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (connection_id, asset_kind, external_id)
);
CREATE INDEX idx_mkt_assets_org ON public.marketing_assets(organization_id);
CREATE INDEX idx_mkt_assets_conn ON public.marketing_assets(connection_id);
CREATE INDEX idx_mkt_assets_kind ON public.marketing_assets(organization_id, provider, asset_kind);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_assets TO authenticated;
GRANT ALL ON public.marketing_assets TO service_role;
ALTER TABLE public.marketing_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_assets FORCE ROW LEVEL SECURITY;
CREATE POLICY mkt_assets_org_select ON public.marketing_assets FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
CREATE POLICY mkt_assets_org_write ON public.marketing_assets FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());
CREATE TRIGGER trg_mkt_assets_touch BEFORE UPDATE ON public.marketing_assets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_mkt_assets_audit AFTER INSERT OR UPDATE OR DELETE ON public.marketing_assets
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- 3) marketing_asset_bindings ------------------------------------------------
CREATE TABLE public.marketing_asset_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.marketing_assets(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL DEFAULT 'primary',
  bound_by UUID REFERENCES auth.users(id),
  bound_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unbound_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (asset_id, purpose)
);
CREATE INDEX idx_mkt_bind_org ON public.marketing_asset_bindings(organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_asset_bindings TO authenticated;
GRANT ALL ON public.marketing_asset_bindings TO service_role;
ALTER TABLE public.marketing_asset_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_asset_bindings FORCE ROW LEVEL SECURITY;
CREATE POLICY mkt_bind_org ON public.marketing_asset_bindings FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());
CREATE TRIGGER trg_mkt_bind_touch BEFORE UPDATE ON public.marketing_asset_bindings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_mkt_bind_audit AFTER INSERT OR UPDATE OR DELETE ON public.marketing_asset_bindings
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- 4) marketing_sync_jobs -----------------------------------------------------
CREATE TABLE public.marketing_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.marketing_assets(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'warm' CHECK (tier IN ('hot','warm','cold')),
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_run_at TIMESTAMPTZ,
  last_status TEXT,
  last_error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  backoff_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (asset_id, tier)
);
CREATE INDEX idx_mkt_sync_org ON public.marketing_sync_jobs(organization_id);
CREATE INDEX idx_mkt_sync_next ON public.marketing_sync_jobs(next_run_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_sync_jobs TO authenticated;
GRANT ALL ON public.marketing_sync_jobs TO service_role;
ALTER TABLE public.marketing_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_sync_jobs FORCE ROW LEVEL SECURITY;
CREATE POLICY mkt_sync_org ON public.marketing_sync_jobs FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());
CREATE TRIGGER trg_mkt_sync_touch BEFORE UPDATE ON public.marketing_sync_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5) marketing_asset_relationships ------------------------------------------
CREATE TABLE public.marketing_asset_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  from_asset_id UUID NOT NULL REFERENCES public.marketing_assets(id) ON DELETE CASCADE,
  to_asset_id UUID NOT NULL REFERENCES public.marketing_assets(id) ON DELETE CASCADE,
  relation_kind TEXT NOT NULL,
  confidence NUMERIC(4,3) NOT NULL DEFAULT 1.000,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_asset_id, to_asset_id, relation_kind)
);
CREATE INDEX idx_mkt_rel_org ON public.marketing_asset_relationships(organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_asset_relationships TO authenticated;
GRANT ALL ON public.marketing_asset_relationships TO service_role;
ALTER TABLE public.marketing_asset_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_asset_relationships FORCE ROW LEVEL SECURITY;
CREATE POLICY mkt_rel_org ON public.marketing_asset_relationships FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());

-- 6) marketing_timeline_events ----------------------------------------------
CREATE TABLE public.marketing_timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES public.marketing_connections(id) ON DELETE SET NULL,
  asset_id UUID REFERENCES public.marketing_assets(id) ON DELETE SET NULL,
  provider TEXT,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','error','success')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mkt_tl_org_time ON public.marketing_timeline_events(organization_id, occurred_at DESC);
CREATE INDEX idx_mkt_tl_conn ON public.marketing_timeline_events(connection_id, occurred_at DESC);
GRANT SELECT, INSERT ON public.marketing_timeline_events TO authenticated;
GRANT ALL ON public.marketing_timeline_events TO service_role;
ALTER TABLE public.marketing_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_timeline_events FORCE ROW LEVEL SECURITY;
CREATE POLICY mkt_tl_org_select ON public.marketing_timeline_events FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
CREATE POLICY mkt_tl_org_insert ON public.marketing_timeline_events FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id());

-- 7) marketing_oauth_states -------------------------------------------------
CREATE TABLE public.marketing_oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_hash TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redirect_after TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '10 minutes'),
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mkt_oauth_org ON public.marketing_oauth_states(organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_oauth_states TO authenticated;
GRANT ALL ON public.marketing_oauth_states TO service_role;
ALTER TABLE public.marketing_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_oauth_states FORCE ROW LEVEL SECURITY;
CREATE POLICY mkt_oauth_org ON public.marketing_oauth_states FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());
