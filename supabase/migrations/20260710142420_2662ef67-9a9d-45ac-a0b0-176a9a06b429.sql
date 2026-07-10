
-- EPIC K.1 — Workspace Persistence (100% additive)
-- All tables: id, organization_id, created_at, updated_at, created_by, updated_by, version, metadata
-- RLS + FORCE RLS + org-scoped policies via public.current_org_id()

-- Reusable updated_at trigger fn is public.touch_updated_at (already exists)

-- ============================================================
-- workspace_layouts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workspace_layouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  grid JSONB NOT NULL DEFAULT '{"columns":12}'::jsonb,
  widgets JSONB NOT NULL DEFAULT '[]'::jsonb,
  positions JSONB NOT NULL DEFAULT '{}'::jsonb,
  sizes JSONB NOT NULL DEFAULT '{}'::jsonb,
  visibility JSONB NOT NULL DEFAULT '{}'::jsonb,
  collapsed JSONB NOT NULL DEFAULT '{}'::jsonb,
  theme TEXT,
  density TEXT,
  layout_version INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, workspace_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_layouts TO authenticated;
GRANT ALL ON public.workspace_layouts TO service_role;
ALTER TABLE public.workspace_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_layouts FORCE ROW LEVEL SECURITY;
CREATE POLICY "layouts_org_select" ON public.workspace_layouts FOR SELECT
  USING (organization_id = public.current_org_id());
CREATE POLICY "layouts_org_write" ON public.workspace_layouts FOR ALL
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());
CREATE INDEX IF NOT EXISTS idx_wsl_org ON public.workspace_layouts(organization_id);
CREATE INDEX IF NOT EXISTS idx_wsl_workspace ON public.workspace_layouts(organization_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_wsl_updated ON public.workspace_layouts(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_wsl_version ON public.workspace_layouts(version);
CREATE TRIGGER trg_wsl_touch BEFORE UPDATE ON public.workspace_layouts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- workspace_widgets
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workspace_widgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  layout_id UUID REFERENCES public.workspace_layouts(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  manifest_id TEXT NOT NULL,
  manifest_version TEXT NOT NULL,
  size TEXT NOT NULL DEFAULT 'md',
  position INTEGER NOT NULL DEFAULT 0,
  visible BOOLEAN NOT NULL DEFAULT true,
  collapsed BOOLEAN NOT NULL DEFAULT false,
  props JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, workspace_id, instance_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_widgets TO authenticated;
GRANT ALL ON public.workspace_widgets TO service_role;
ALTER TABLE public.workspace_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_widgets FORCE ROW LEVEL SECURITY;
CREATE POLICY "wsw_org_select" ON public.workspace_widgets FOR SELECT
  USING (organization_id = public.current_org_id());
CREATE POLICY "wsw_org_write" ON public.workspace_widgets FOR ALL
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());
CREATE INDEX IF NOT EXISTS idx_wsw_org ON public.workspace_widgets(organization_id);
CREATE INDEX IF NOT EXISTS idx_wsw_layout ON public.workspace_widgets(layout_id);
CREATE INDEX IF NOT EXISTS idx_wsw_updated ON public.workspace_widgets(updated_at DESC);
CREATE TRIGGER trg_wsw_touch BEFORE UPDATE ON public.workspace_widgets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- workspace_preferences
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workspace_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  theme TEXT,
  density TEXT,
  sidebar JSONB NOT NULL DEFAULT '{}'::jsonb,
  shortcuts JSONB NOT NULL DEFAULT '{}'::jsonb,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_preferences TO authenticated;
GRANT ALL ON public.workspace_preferences TO service_role;
ALTER TABLE public.workspace_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_preferences FORCE ROW LEVEL SECURITY;
CREATE POLICY "wsp_org_select" ON public.workspace_preferences FOR SELECT
  USING (organization_id = public.current_org_id());
CREATE POLICY "wsp_user_write" ON public.workspace_preferences FOR ALL
  USING (organization_id = public.current_org_id() AND user_id = auth.uid())
  WITH CHECK (organization_id = public.current_org_id() AND user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_wsp_org ON public.workspace_preferences(organization_id);
CREATE INDEX IF NOT EXISTS idx_wsp_user ON public.workspace_preferences(user_id);
CREATE TRIGGER trg_wsp_touch BEFORE UPDATE ON public.workspace_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- workspace_bookmarks
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workspace_bookmarks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('favorite','pinned_widget','pinned_report','pinned_recommendation','pinned_search','pinned_dashboard')),
  ref_type TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  label TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id, kind, ref_type, ref_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_bookmarks TO authenticated;
GRANT ALL ON public.workspace_bookmarks TO service_role;
ALTER TABLE public.workspace_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_bookmarks FORCE ROW LEVEL SECURITY;
CREATE POLICY "wsb_org_select" ON public.workspace_bookmarks FOR SELECT
  USING (organization_id = public.current_org_id());
CREATE POLICY "wsb_user_write" ON public.workspace_bookmarks FOR ALL
  USING (organization_id = public.current_org_id() AND user_id = auth.uid())
  WITH CHECK (organization_id = public.current_org_id() AND user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_wsb_org ON public.workspace_bookmarks(organization_id);
CREATE INDEX IF NOT EXISTS idx_wsb_user ON public.workspace_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_wsb_kind ON public.workspace_bookmarks(kind);
CREATE TRIGGER trg_wsb_touch BEFORE UPDATE ON public.workspace_bookmarks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- workspace_snapshots
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workspace_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  integrity_hash TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  workspace_version INTEGER NOT NULL DEFAULT 1,
  origin TEXT NOT NULL DEFAULT 'manual',
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_snapshots TO authenticated;
GRANT ALL ON public.workspace_snapshots TO service_role;
ALTER TABLE public.workspace_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_snapshots FORCE ROW LEVEL SECURITY;
CREATE POLICY "wss_org_select" ON public.workspace_snapshots FOR SELECT
  USING (organization_id = public.current_org_id());
CREATE POLICY "wss_org_write" ON public.workspace_snapshots FOR ALL
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());
CREATE INDEX IF NOT EXISTS idx_wss_org ON public.workspace_snapshots(organization_id);
CREATE INDEX IF NOT EXISTS idx_wss_workspace ON public.workspace_snapshots(organization_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_wss_created ON public.workspace_snapshots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wss_version ON public.workspace_snapshots(workspace_version);
CREATE INDEX IF NOT EXISTS idx_wss_hash ON public.workspace_snapshots(integrity_hash);
CREATE TRIGGER trg_wss_touch BEFORE UPDATE ON public.workspace_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- workspace_share_tokens
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workspace_share_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  snapshot_id UUID REFERENCES public.workspace_snapshots(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  audience TEXT NOT NULL CHECK (audience IN ('public_read','org_member','workspace_viewer')),
  nonce TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_share_tokens TO authenticated;
GRANT ALL ON public.workspace_share_tokens TO service_role;
ALTER TABLE public.workspace_share_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_share_tokens FORCE ROW LEVEL SECURITY;
CREATE POLICY "wst_org_select" ON public.workspace_share_tokens FOR SELECT
  USING (organization_id = public.current_org_id());
CREATE POLICY "wst_org_write" ON public.workspace_share_tokens FOR ALL
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());
CREATE INDEX IF NOT EXISTS idx_wst_org ON public.workspace_share_tokens(organization_id);
CREATE INDEX IF NOT EXISTS idx_wst_snapshot ON public.workspace_share_tokens(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_wst_expires ON public.workspace_share_tokens(expires_at);
CREATE TRIGGER trg_wst_touch BEFORE UPDATE ON public.workspace_share_tokens
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- workspace_feature_flags
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workspace_feature_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  widget TEXT NOT NULL,
  flag TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  scope TEXT NOT NULL DEFAULT 'org',
  rollout INTEGER NOT NULL DEFAULT 0 CHECK (rollout BETWEEN 0 AND 100),
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, widget, flag, scope)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_feature_flags TO authenticated;
GRANT ALL ON public.workspace_feature_flags TO service_role;
ALTER TABLE public.workspace_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_feature_flags FORCE ROW LEVEL SECURITY;
CREATE POLICY "wsf_org_select" ON public.workspace_feature_flags FOR SELECT
  USING (organization_id = public.current_org_id());
CREATE POLICY "wsf_org_write" ON public.workspace_feature_flags FOR ALL
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());
CREATE INDEX IF NOT EXISTS idx_wsf_org ON public.workspace_feature_flags(organization_id);
CREATE INDEX IF NOT EXISTS idx_wsf_widget ON public.workspace_feature_flags(widget);
CREATE TRIGGER trg_wsf_touch BEFORE UPDATE ON public.workspace_feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- workspace_recent_items
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workspace_recent_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('report','dashboard','search','insight','recommendation','timeline','workspace','widget')),
  item_ref TEXT NOT NULL,
  label TEXT,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id, item_type, item_ref)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_recent_items TO authenticated;
GRANT ALL ON public.workspace_recent_items TO service_role;
ALTER TABLE public.workspace_recent_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_recent_items FORCE ROW LEVEL SECURITY;
CREATE POLICY "wsr_org_select" ON public.workspace_recent_items FOR SELECT
  USING (organization_id = public.current_org_id());
CREATE POLICY "wsr_user_write" ON public.workspace_recent_items FOR ALL
  USING (organization_id = public.current_org_id() AND user_id = auth.uid())
  WITH CHECK (organization_id = public.current_org_id() AND user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_wsr_org ON public.workspace_recent_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_wsr_user ON public.workspace_recent_items(user_id);
CREATE INDEX IF NOT EXISTS idx_wsr_visited ON public.workspace_recent_items(visited_at DESC);
CREATE TRIGGER trg_wsr_touch BEFORE UPDATE ON public.workspace_recent_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- workspace_dashboards
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workspace_dashboards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  layout_id UUID REFERENCES public.workspace_layouts(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, workspace_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_dashboards TO authenticated;
GRANT ALL ON public.workspace_dashboards TO service_role;
ALTER TABLE public.workspace_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_dashboards FORCE ROW LEVEL SECURITY;
CREATE POLICY "wsd_org_select" ON public.workspace_dashboards FOR SELECT
  USING (organization_id = public.current_org_id());
CREATE POLICY "wsd_org_write" ON public.workspace_dashboards FOR ALL
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());
CREATE INDEX IF NOT EXISTS idx_wsd_org ON public.workspace_dashboards(organization_id);
CREATE INDEX IF NOT EXISTS idx_wsd_workspace ON public.workspace_dashboards(organization_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_wsd_updated ON public.workspace_dashboards(updated_at DESC);
CREATE TRIGGER trg_wsd_touch BEFORE UPDATE ON public.workspace_dashboards
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
