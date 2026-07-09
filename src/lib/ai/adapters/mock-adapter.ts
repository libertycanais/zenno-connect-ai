// FEATURE P0.6 — Onda 4 · Mock / Sandbox Adapter
// Deterministic AIProviderAdapter used for tests, local dev and staging drills.
// Never touches the network. Supports scripted responses, forced errors and
// streaming simulation. Registered as providerId = "mock".

import type { AIProviderAdapter, AdapterRequest, AdapterResponse } from "../provider-adapter";
import type { StreamEvent } from "../streaming";
import type { ToolCall } from "../tools";

export type MockScript =
  | { kind: "text"; text: string; tokensIn?: number; tokensOut?: number; latencyMs?: number }
  | { kind: "toolCall"; call: ToolCall; text?: string }
  | { kind: "error"; status: number; message: string }
  | { kind: "timeout"; delayMs: number };

export type MockAdapterOptions = {
  providerId?: string;
  supportedModels?: readonly string[];
  scripts?: MockScript[];      // consumed FIFO; last is repeated
  latencyMs?: number;
  now?: () => number;
};

const DEFAULT_MODELS = ["mock-fast", "mock-smart"] as const;

export class MockProviderAdapter implements AIProviderAdapter {
  readonly providerId: string;
  private readonly models: readonly string[];
  private scripts: MockScript[];
  private readonly latencyMs: number;

  constructor(opts: MockAdapterOptions = {}) {
    this.providerId = opts.providerId ?? "mock";
    this.models = opts.supportedModels ?? DEFAULT_MODELS;
    this.scripts = [...(opts.scripts ?? [{ kind: "text", text: "mock response" }])];
    this.latencyMs = opts.latencyMs ?? 0;
  }

  supportsModel(modelId: string): boolean {
    return this.models.includes(modelId);
  }

  enqueue(script: MockScript): void { this.scripts.push(script); }
  reset(scripts: MockScript[] = [{ kind: "text", text: "mock response" }]): void { this.scripts = [...scripts]; }

  private nextScript(): MockScript {
    if (this.scripts.length === 1) return this.scripts[0];
    return this.scripts.shift() ?? { kind: "text", text: "mock response" };
  }

  async execute(req: AdapterRequest): Promise<AdapterResponse> {
    const script = this.nextScript();
    await this.wait(this.latencyMs, req.signal);
    switch (script.kind) {
      case "text":
        return {
          text: script.text,
          toolCalls: [],
          tokensIn: script.tokensIn ?? this.estimateTokens(req.userPrompt),
          tokensOut: script.tokensOut ?? this.estimateTokens(script.text),
          finishReason: "stop",
        };
      case "toolCall":
        return {
          text: script.text ?? "",
          toolCalls: [script.call],
          tokensIn: this.estimateTokens(req.userPrompt),
          tokensOut: 0,
          finishReason: "tool",
        };
      case "error": {
        const err = new Error(script.message) as Error & { status?: number };
        err.status = script.status;
        throw err;
      }
      case "timeout":
        await this.wait(script.delayMs, req.signal);
        return { text: "", toolCalls: [], tokensIn: 0, tokensOut: 0, finishReason: "stop" };
    }
  }

  async *stream(req: AdapterRequest): AsyncIterable<StreamEvent> {
    yield { kind: "start", provider: this.providerId, model: req.model };
    const script = this.nextScript();
    if (script.kind === "error") {
      yield { kind: "error", code: `HTTP_${script.status}`, message: script.message };
      yield { kind: "end", reason: "error" };
      return;
    }
    if (script.kind === "timeout") {
      await this.wait(script.delayMs, req.signal);
      yield { kind: "end", reason: "abort" };
      return;
    }
    const text = script.kind === "text" ? script.text : (script.text ?? "");
    // Chunk into ~8-char slices to emulate streaming.
    for (let i = 0; i < text.length; i += 8) {
      if (req.signal.aborted) { yield { kind: "end", reason: "abort" }; return; }
      yield { kind: "delta", text: text.slice(i, i + 8) };
    }
    if (script.kind === "toolCall") {
      yield { kind: "tool_call", id: script.call.id, name: script.call.name, args: script.call.arguments };
    }
    const tokensIn = this.estimateTokens(req.userPrompt);
    const tokensOut = this.estimateTokens(text);
    yield { kind: "usage", tokensIn, tokensOut };
    yield { kind: "end", reason: script.kind === "toolCall" ? "tool" : "stop" };
  }

  async ping(): Promise<{ ok: boolean; latencyMs: number; errorCode?: string }> {
    return { ok: true, latencyMs: 1 };
  }

  private estimateTokens(text: string): number {
    return Math.max(1, Math.ceil((text?.length ?? 0) / 4));
  }

  private wait(ms: number, signal: AbortSignal): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { signal.removeEventListener("abort", onAbort); resolve(); }, ms);
      const onAbort = () => { clearTimeout(t); reject(new DOMException("aborted", "AbortError")); };
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }
}

export const mockAdapter = new MockProviderAdapter();
