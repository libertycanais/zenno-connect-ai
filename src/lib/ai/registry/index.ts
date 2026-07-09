// FEATURE P0.6 — Onda 3 · Provider Registry
// Central metadata for AI providers. Additive: does NOT touch src/providers/ai/*.
// Providers here are *runtime metadata* — capabilities, pricing, models — used
// by the Model Selection Engine and Cost Optimizer. Actual execution still
// flows through the Provider Layer (src/providers/ai/*).

import type { AIProviderName } from "../types";

export type ProviderStatus = "online" | "offline" | "degraded";

export type ModelDescriptor = {
  id: string;
  displayName: string;
  maxContext: number;
  supportsStreaming: boolean;
  supportsJson: boolean;
  supportsTools: boolean;
  supportsImages: boolean;
  supportsReasoning: boolean;
  supportsVision: boolean;
  costInputPerMTokCents: number;   // USD cents per 1M input tokens
  costOutputPerMTokCents: number;  // USD cents per 1M output tokens
  priority: number;                // higher = preferred when tied
};

export type ProviderDescriptor = {
  providerId: AIProviderName | "anthropic" | "openai" | "google" | "xai" | "deepseek" | "groq";
  displayName: string;
  supportedModels: ModelDescriptor[];
  status: ProviderStatus;
  priority: number;
};

const CLAUDE: ProviderDescriptor = {
  providerId: "anthropic",
  displayName: "Claude (Anthropic)",
  status: "online",
  priority: 90,
  supportedModels: [
    {
      id: "claude-3-5-sonnet-latest",
      displayName: "Claude 3.5 Sonnet",
      maxContext: 200_000,
      supportsStreaming: true,
      supportsJson: true,
      supportsTools: true,
      supportsImages: true,
      supportsReasoning: false,
      supportsVision: true,
      costInputPerMTokCents: 300,
      costOutputPerMTokCents: 1500,
      priority: 90,
    },
    {
      id: "claude-3-5-haiku-latest",
      displayName: "Claude 3.5 Haiku",
      maxContext: 200_000,
      supportsStreaming: true,
      supportsJson: true,
      supportsTools: true,
      supportsImages: true,
      supportsReasoning: false,
      supportsVision: true,
      costInputPerMTokCents: 80,
      costOutputPerMTokCents: 400,
      priority: 70,
    },
  ],
};

const OPENAI: ProviderDescriptor = {
  providerId: "openai",
  displayName: "OpenAI",
  status: "online",
  priority: 95,
  supportedModels: [
    {
      id: "gpt-5.5",
      displayName: "GPT-5.5",
      maxContext: 400_000,
      supportsStreaming: true,
      supportsJson: true,
      supportsTools: true,
      supportsImages: true,
      supportsReasoning: true,
      supportsVision: true,
      costInputPerMTokCents: 500,
      costOutputPerMTokCents: 2000,
      priority: 100,
    },
    {
      id: "gpt-5.5-mini",
      displayName: "GPT-5.5 Mini",
      maxContext: 200_000,
      supportsStreaming: true,
      supportsJson: true,
      supportsTools: true,
      supportsImages: true,
      supportsReasoning: false,
      supportsVision: true,
      costInputPerMTokCents: 100,
      costOutputPerMTokCents: 400,
      priority: 80,
    },
  ],
};

const GEMINI: ProviderDescriptor = {
  providerId: "google",
  displayName: "Gemini (Google)",
  status: "online",
  priority: 85,
  supportedModels: [
    {
      id: "gemini-2.5-pro",
      displayName: "Gemini 2.5 Pro",
      maxContext: 1_000_000,
      supportsStreaming: true,
      supportsJson: true,
      supportsTools: true,
      supportsImages: true,
      supportsReasoning: true,
      supportsVision: true,
      costInputPerMTokCents: 125,
      costOutputPerMTokCents: 500,
      priority: 88,
    },
    {
      id: "gemini-2.5-flash",
      displayName: "Gemini 2.5 Flash",
      maxContext: 1_000_000,
      supportsStreaming: true,
      supportsJson: true,
      supportsTools: true,
      supportsImages: true,
      supportsReasoning: false,
      supportsVision: true,
      costInputPerMTokCents: 30,
      costOutputPerMTokCents: 120,
      priority: 75,
    },
  ],
};

const GROK: ProviderDescriptor = {
  providerId: "xai",
  displayName: "Grok (xAI)",
  status: "online",
  priority: 60,
  supportedModels: [
    {
      id: "grok-2-latest",
      displayName: "Grok 2",
      maxContext: 131_072,
      supportsStreaming: true,
      supportsJson: true,
      supportsTools: true,
      supportsImages: false,
      supportsReasoning: false,
      supportsVision: false,
      costInputPerMTokCents: 200,
      costOutputPerMTokCents: 1000,
      priority: 60,
    },
  ],
};

const DEEPSEEK: ProviderDescriptor = {
  providerId: "deepseek",
  displayName: "DeepSeek",
  status: "online",
  priority: 55,
  supportedModels: [
    {
      id: "deepseek-chat",
      displayName: "DeepSeek Chat",
      maxContext: 128_000,
      supportsStreaming: true,
      supportsJson: true,
      supportsTools: true,
      supportsImages: false,
      supportsReasoning: false,
      supportsVision: false,
      costInputPerMTokCents: 14,
      costOutputPerMTokCents: 28,
      priority: 50,
    },
    {
      id: "deepseek-reasoner",
      displayName: "DeepSeek Reasoner",
      maxContext: 128_000,
      supportsStreaming: true,
      supportsJson: true,
      supportsTools: false,
      supportsImages: false,
      supportsReasoning: true,
      supportsVision: false,
      costInputPerMTokCents: 55,
      costOutputPerMTokCents: 219,
      priority: 65,
    },
  ],
};

const DEFAULT_REGISTRY: ProviderDescriptor[] = [OPENAI, CLAUDE, GEMINI, GROK, DEEPSEEK];

export class ProviderRegistry {
  private providers = new Map<string, ProviderDescriptor>();

  constructor(seed: ProviderDescriptor[] = DEFAULT_REGISTRY) {
    for (const p of seed) this.register(p);
  }

  register(p: ProviderDescriptor): void {
    this.providers.set(p.providerId, p);
  }

  get(providerId: string): ProviderDescriptor | undefined {
    return this.providers.get(providerId);
  }

  list(): ProviderDescriptor[] {
    return [...this.providers.values()];
  }

  findModel(providerId: string, modelId: string): ModelDescriptor | undefined {
    return this.get(providerId)?.supportedModels.find((m) => m.id === modelId);
  }

  allModels(): Array<{ provider: ProviderDescriptor; model: ModelDescriptor }> {
    return this.list().flatMap((p) => p.supportedModels.map((m) => ({ provider: p, model: m })));
  }

  setStatus(providerId: string, status: ProviderStatus): void {
    const p = this.providers.get(providerId);
    if (p) this.providers.set(providerId, { ...p, status });
  }
}

export const providerRegistry = new ProviderRegistry();
