import type { ProviderContext } from "@/providers/common/provider.types";

export type AdsAccountRef = {
  id: string;            // customer_id (Google) / ad_account_id (Meta)
  name: string;
  currency?: string | null;
  timezone?: string | null;
  isManager?: boolean;
  parentId?: string | null;
};

export type AdsCampaign = {
  id: string;
  name: string;
  status: string;
  objective?: string | null;
};

export type AdsInsight = {
  campaignId: string;
  date: string;      // ISO date
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
};

export type AdsConversionEvent = {
  eventName: string;
  eventTime: number;      // unix seconds
  value?: number;
  currency?: string;
  userData?: Record<string, unknown>;   // hashed user identifiers
  customData?: Record<string, unknown>;
};

export type AdsAccountConnection = {
  accessToken: string;
  refreshToken?: string | null;
  externalAccountId: string;
};

/**
 * Interface unificada para plataformas de anúncios.
 * Consumers (server functions de domínio) devem depender APENAS desta interface.
 */
export interface AdsProvider {
  readonly name: string;
  connectAccount(
    ctx: ProviderContext,
    input: { code: string; redirectUri: string },
  ): Promise<AdsAccountRef[]>;
  getCampaigns(
    ctx: ProviderContext,
    conn: AdsAccountConnection,
  ): Promise<AdsCampaign[]>;
  getInsights(
    ctx: ProviderContext,
    conn: AdsAccountConnection,
    range: { since: string; until: string },
  ): Promise<AdsInsight[]>;
  sendConversion(
    ctx: ProviderContext,
    conn: AdsAccountConnection,
    event: AdsConversionEvent,
  ): Promise<{ ok: boolean; externalId?: string }>;
  disconnectAccount(
    ctx: ProviderContext,
    conn: AdsAccountConnection,
  ): Promise<void>;
}
