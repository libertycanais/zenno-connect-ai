
-- RC1.1: Persistência de revogação de share tokens (idx para lookup por revoked_at + nonce)
CREATE INDEX IF NOT EXISTS idx_wst_nonce ON public.workspace_share_tokens(nonce);
CREATE INDEX IF NOT EXISTS idx_wst_revoked ON public.workspace_share_tokens(revoked_at) WHERE revoked_at IS NOT NULL;

-- RC1.2: Rotação versionada de AI_ENCRYPTION_KEY
ALTER TABLE public.ai_provider_credentials
  ADD COLUMN IF NOT EXISTS key_version INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_ai_cred_key_version ON public.ai_provider_credentials(key_version);

-- RC1.4: Índice composto (organization_id, status, created_at DESC)
CREATE INDEX IF NOT EXISTS idx_ai_recs_org_status_created
  ON public.ai_recommendations(organization_id, status, created_at DESC);
