import type { ProviderContext } from "@/providers/common/provider.types";

export type AIMessage = { role: "system" | "user" | "assistant" | "tool"; content: string };
export type AIChatOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: AITool[];
};
export type AIChatResult = {
  content: string;
  toolCalls?: Array<{ name: string; arguments: unknown }>;
  usage?: { promptTokens?: number; completionTokens?: number };
};

export type AITool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;   // JSON schema
};

export type AIVisionInput = {
  images: Array<{ url: string } | { base64: string; mimeType: string }>;
  prompt: string;
  model?: string;
};

export type AIEmbeddingInput = { input: string | string[]; model?: string };
export type AIEmbeddingResult = { vectors: number[][]; model: string };

export type AIActionRequest = { action: string; args: Record<string, unknown> };
export type AIActionResult  = { ok: boolean; result?: unknown; error?: string };

/**
 * Interface unificada para provedores de IA (Lovable AI Gateway, OpenAI, Anthropic).
 */
export interface AIProvider {
  readonly name: string;
  chat(ctx: ProviderContext, messages: AIMessage[], opts?: AIChatOptions): Promise<AIChatResult>;
  vision(ctx: ProviderContext, input: AIVisionInput): Promise<AIChatResult>;
  embeddings(ctx: ProviderContext, input: AIEmbeddingInput): Promise<AIEmbeddingResult>;
  executeAction(ctx: ProviderContext, req: AIActionRequest): Promise<AIActionResult>;
}
