// FEATURE P0.6 — Onda 3 · Provider Adapter contract
// Every provider integration MUST implement this shape. It is the ONLY seam
// between Zenno runtime and external AI providers.
//
// Real adapters (OpenAI, Anthropic, Gemini, Grok, DeepSeek) are implemented in
// Onda 4 under src/providers/ai/*. This file defines the contract they conform to.

import type { StreamEvent } from "../streaming";
import type { ToolCall, ToolDescriptor } from "../tools";

export type AdapterRequest = {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  tools?: ToolDescriptor[];
  toolChoice?: "auto" | "none" | { name: string };
  jsonMode?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  signal: AbortSignal;
};

export type AdapterResponse = {
  text: string;
  toolCalls: ToolCall[];
  tokensIn: number;
  tokensOut: number;
  finishReason: "stop" | "length" | "tool" | "error";
};

export interface AIProviderAdapter {
  readonly providerId: string;
  supportsModel(modelId: string): boolean;
  execute(req: AdapterRequest): Promise<AdapterResponse>;
  stream(req: AdapterRequest): AsyncIterable<StreamEvent>;
  ping(): Promise<{ ok: boolean; latencyMs: number; errorCode?: string }>;
}
