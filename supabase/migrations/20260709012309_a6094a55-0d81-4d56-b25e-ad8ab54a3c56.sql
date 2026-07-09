
-- 1. Extend role enum (additive; existing values preserved)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='app_role' AND e.enumlabel='analyst') THEN
    ALTER TYPE public.app_role ADD VALUE 'analyst';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='app_role' AND e.enumlabel='viewer') THEN
    ALTER TYPE public.app_role ADD VALUE 'viewer';
  END IF;
END $$;

-- 2. Extend organizations with profile/settings columns
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS logo_url    TEXT,
  ADD COLUMN IF NOT EXISTS domain      TEXT,
  ADD COLUMN IF NOT EXISTS timezone    TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS language    TEXT NOT NULL DEFAULT 'pt-BR',
  ADD COLUMN IF NOT EXISTS currency    TEXT NOT NULL DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS settings    JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3. Invitations table
CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  role            public.app_role NOT NULL,
  token_hash      TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','accepted','revoked','expired')),
  invited_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at     TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS organization_invitations_token_hash_uniq
  ON public.organization_invitations (token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS organization_invitations_org_email_pending_uniq
  ON public.organization_invitations (organization_id, lower(email))
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS organization_invitations_org_idx
  ON public.organization_invitations (organization_id, status);

-- 4. GRANTs (before RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_invitations TO authenticated;
GRANT ALL ON public.organization_invitations TO service_role;

-- 5. RLS
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- SELECT: members of the org (uses existing app_private.current_org_id())
CREATE POLICY "members view own org invitations"
  ON public.organization_invitations
  FOR SELECT TO authenticated
  USING (organization_id = app_private.current_org_id());

-- INSERT: owner or admin of the same org
CREATE POLICY "owners/admins create invitations"
  ON public.organization_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = app_private.current_org_id()
    AND (
      app_private.has_role(auth.uid(), 'owner'::app_role, organization_id)
      OR app_private.has_role(auth.uid(), 'admin'::app_role, organization_id)
    )
  );

-- UPDATE: owner or admin of the same org (used to revoke / resend)
CREATE POLICY "owners/admins update invitations"
  ON public.organization_invitations
  FOR UPDATE TO authenticated
  USING (
    organization_id = app_private.current_org_id()
    AND (
      app_private.has_role(auth.uid(), 'owner'::app_role, organization_id)
      OR app_private.has_role(auth.uid(), 'admin'::app_role, organization_id)
    )
  )
  WITH CHECK (organization_id = app_private.current_org_id());

-- DELETE: owners only
CREATE POLICY "owners delete invitations"
  ON public.organization_invitations
  FOR DELETE TO authenticated
  USING (
    organization_id = app_private.current_org_id()
    AND app_private.has_role(auth.uid(), 'owner'::app_role, organization_id)
  );

-- 6. touch_updated_at trigger
DROP TRIGGER IF EXISTS trg_organization_invitations_touch ON public.organization_invitations;
CREATE TRIGGER trg_organization_invitations_touch
  BEFORE UPDATE ON public.organization_invitations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 7. Audit triggers (reuse existing infra)
DROP TRIGGER IF EXISTS trg_audit_organization_invitations ON public.organization_invitations;
CREATE TRIGGER trg_audit_organization_invitations
  AFTER INSERT OR UPDATE OR DELETE ON public.organization_invitations
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- organizations audit trigger may already exist per SECURITY.md; ensure idempotent
DROP TRIGGER IF EXISTS trg_audit_organizations ON public.organizations;
CREATE TRIGGER trg_audit_organizations
  AFTER INSERT OR UPDATE OR DELETE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
