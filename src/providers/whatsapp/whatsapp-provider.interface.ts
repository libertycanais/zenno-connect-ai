import type { ProviderContext } from "@/providers/common/provider.types";

export type WhatsAppInstanceRef = {
  id: string;
  status: "connected" | "disconnected" | "pending" | "unknown";
  phoneNumber?: string | null;
};

export type WhatsAppOutboundMessage = {
  to: string;              // E.164 or bare digits
  text?: string;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "audio" | "document";
  caption?: string;
};

export type WhatsAppInboundEvent = {
  instanceId: string;
  event: "message" | "status" | "connection" | "other";
  fromMe: boolean;
  from?: string;
  externalId?: string | null;
  text?: string | null;
  raw: unknown;
};

/**
 * Interface unificada para provedores de WhatsApp (Uazapi, WABA, etc).
 */
export interface WhatsAppProvider {
  readonly name: string;
  createInstance(ctx: ProviderContext, input: { name: string }): Promise<WhatsAppInstanceRef>;
  getInstanceStatus(ctx: ProviderContext, instanceId: string): Promise<WhatsAppInstanceRef>;
  sendMessage(
    ctx: ProviderContext,
    instanceId: string,
    msg: WhatsAppOutboundMessage,
  ): Promise<{ ok: boolean; externalId?: string }>;
  /** Normaliza o payload cru do webhook em um evento canônico. */
  receiveWebhook(
    ctx: ProviderContext,
    instanceId: string,
    payload: unknown,
  ): Promise<WhatsAppInboundEvent>;
  disconnectInstance(ctx: ProviderContext, instanceId: string): Promise<void>;
}
