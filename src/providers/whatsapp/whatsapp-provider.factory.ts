import { UnknownProviderError } from "@/providers/common/provider.types";
import type { WhatsAppProvider } from "@/providers/whatsapp/whatsapp-provider.interface";
import { UazapiProvider } from "@/providers/whatsapp/uazapi.provider";

const SUPPORTED = ["uazapi"] as const;
export type WhatsAppProviderName = typeof SUPPORTED[number];

const registry: Record<WhatsAppProviderName, () => WhatsAppProvider> = {
  uazapi: () => new UazapiProvider(),
};

export function getWhatsAppProvider(name?: string): WhatsAppProvider {
  const requested = (name ?? process.env.WHATSAPP_PROVIDER ?? "uazapi").toLowerCase() as WhatsAppProviderName;
  const factory = registry[requested];
  if (!factory) throw new UnknownProviderError("whatsapp", requested, [...SUPPORTED]);
  return factory();
}

export function listWhatsAppProviders(): readonly string[] {
  return SUPPORTED;
}
