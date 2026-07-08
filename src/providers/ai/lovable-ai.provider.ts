// Lovable AI Gateway adapter — implementação do AIProvider.
// Consumers (copiloto, ai actions) devem depender APENAS da interface AIProvider,
// nunca importar `@/integrations/lovable` diretamente.
import {
  ProviderError,
  ProviderNotConfiguredError,
  type ProviderContext,
} from "@/providers/common/provider.types";
import type {
  AIChatOptions,
  AIChatResult,
  AIEmbeddingInput,
  AIEmbeddingResult,
  AIMessage,
  AIProvider,
  AIActionRequest,
  AIActionResult,
  AIVisionInput,
} from "@/providers/ai/ai-provider.interface";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

function key() {
  const k = process.env.LOVABLE_API_KEY;
  if (!k) throw new ProviderNotConfiguredError("lovable_ai", ["LOVABLE_API_KEY"]);
  return k;
}

export class LovableAIProvider implements AIProvider {
  readonly name = "lovable";

  async chat(_ctx: ProviderContext, messages: AIMessage[], opts?: AIChatOptions): Promise<AIChatResult> {
    const res = await fetch(`${GATEWAY}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts?.model ?? "google/gemini-2.5-flash",
        messages,
        temperature: opts?.temperature,
        max_tokens: opts?.maxTokens,
        tools: opts?.tools?.map((t) => ({
          type: "function",
          function: { name: t.name, description: t.description, parameters: t.parameters },
        })),
      }),
    });
    const json = await res.json() as {
      choices?: Array<{ message?: { content?: string; tool_calls?: Array<{ function: { name: string; arguments: string } }> } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      error?: { message: string };
    };
    if (!res.ok) throw new ProviderError("lovable_ai", "chat_failed", json.error?.message ?? "chat_error");
    const choice = json.choices?.[0]?.message;
    return {
      content: choice?.content ?? "",
      toolCalls: choice?.tool_calls?.map((t) => ({
        name: t.function.name,
        arguments: safeJson(t.function.arguments),
      })),
      usage: json.usage
        ? { promptTokens: json.usage.prompt_tokens, completionTokens: json.usage.completion_tokens }
        : undefined,
    };
  }

  async vision(ctx: ProviderContext, input: AIVisionInput): Promise<AIChatResult> {
    const content: Array<Record<string, unknown>> = [{ type: "text", text: input.prompt }];
    for (const img of input.images) {
      if ("url" in img) content.push({ type: "image_url", image_url: { url: img.url } });
      else content.push({ type: "image_url", image_url: { url: `data:${img.mimeType};base64,${img.base64}` } });
    }
    return this.chat(ctx, [{ role: "user", content: JSON.stringify(content) }] as AIMessage[], { model: input.model });
  }

  async embeddings(_ctx: ProviderContext, input: AIEmbeddingInput): Promise<AIEmbeddingResult> {
    const model = input.model ?? "openai/text-embedding-3-small";
    const res = await fetch(`${GATEWAY}/embeddings`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: input.input }),
    });
    const json = await res.json() as { data?: Array<{ embedding: number[] }>; error?: { message: string } };
    if (!res.ok) throw new ProviderError("lovable_ai", "embeddings_failed", json.error?.message ?? "error");
    return { vectors: (json.data ?? []).map((d) => d.embedding), model };
  }

  async executeAction(ctx: ProviderContext, req: AIActionRequest): Promise<AIActionResult> {
    // Ação genérica: delega ao chat com tools; consumers específicos podem
    // usar `chat` diretamente com suas próprias tools. Este método é um atalho.
    const result = await this.chat(ctx, [
      { role: "system", content: "Execute the requested action and return a JSON result." },
      { role: "user", content: JSON.stringify(req) },
    ]);
    return { ok: true, result: result.content };
  }
}

function safeJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}
