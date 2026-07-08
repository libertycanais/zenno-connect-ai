
-- 1. meta_ads_insights: granularidade por criativo
ALTER TABLE public.meta_ads_insights
  ADD COLUMN IF NOT EXISTS ad_id TEXT,
  ADD COLUMN IF NOT EXISTS adset_id TEXT,
  ADD COLUMN IF NOT EXISTS ad_name TEXT,
  ADD COLUMN IF NOT EXISTS adset_name TEXT,
  ADD COLUMN IF NOT EXISTS campaign_name TEXT;

CREATE INDEX IF NOT EXISTS idx_meta_ads_insights_ad_id
  ON public.meta_ads_insights (organization_id, ad_id, date_start);

-- 2. whatsapp_instances: suporte a WABA oficial
ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'uazapi'
    CHECK (provider IN ('uazapi', 'waba')),
  ADD COLUMN IF NOT EXISTS waba_phone_id TEXT,
  ADD COLUMN IF NOT EXISTS waba_business_id TEXT;

-- 3. whatsapp_chats: modalidade e cobrança
ALTER TABLE public.whatsapp_chats
  ADD COLUMN IF NOT EXISTS payment_mode TEXT
    CHECK (payment_mode IN ('upfront', 'cod', 'postpaid')),
  ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_due_at
  ON public.whatsapp_chats (organization_id, due_at)
  WHERE due_at IS NOT NULL AND conversion_status = 'pending';
