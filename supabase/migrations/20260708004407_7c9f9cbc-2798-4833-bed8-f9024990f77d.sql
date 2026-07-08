
-- Extend ad accounts with manager/parent linkage
ALTER TABLE public.google_ad_accounts
  ADD COLUMN IF NOT EXISTS is_manager boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_account_id uuid REFERENCES public.google_ad_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS descriptive_name text;

CREATE INDEX IF NOT EXISTS idx_google_ad_accounts_parent ON public.google_ad_accounts(parent_account_id);

ALTER TABLE public.meta_ad_accounts
  ADD COLUMN IF NOT EXISTS is_manager boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_account_id uuid REFERENCES public.meta_ad_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS is_client_account boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_meta_ad_accounts_parent ON public.meta_ad_accounts(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_accounts_business ON public.meta_ad_accounts(business_id);

-- Active client selection per user (last selected client account across the app)
CREATE TABLE IF NOT EXISTS public.active_client_selections (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('meta','google')),
  account_id uuid NOT NULL,
  account_label text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.active_client_selections TO authenticated;
GRANT ALL ON public.active_client_selections TO service_role;

ALTER TABLE public.active_client_selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own active client"
  ON public.active_client_selections FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users upsert own active client"
  ON public.active_client_selections FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND organization_id = public.current_org_id());

CREATE POLICY "Users update own active client"
  ON public.active_client_selections FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own active client"
  ON public.active_client_selections FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
