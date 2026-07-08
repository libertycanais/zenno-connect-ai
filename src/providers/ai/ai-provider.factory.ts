import { UnknownProviderError } from "@/providers/common/provider.types";
import type { AIProvider } from "@/providers/ai/ai-provider.interface";
import { LovableAIProvider } from "@/providers/ai/lovable-ai.provider";

const SUPPORTED = ["lovable"] as const;
export type AIProviderName = typeof SUPPORTED[number];

const registry: Record<AIProviderName, () => AIProvider> = {
  lovable: () => new LovableAIProvider(),
};

export function getAIProvider(name?: string): AIProvider {
  const requested = (name ?? process.env.AI_PROVIDER ?? "lovable").toLowerCase() as AIProviderName;
  const factory = registry[requested];
  if (!factory) throw new UnknownProviderError("ai", requested, [...SUPPORTED]);
  return factory();
}

export function listAIProviders(): readonly string[] {
  return SUPPORTED;
}
