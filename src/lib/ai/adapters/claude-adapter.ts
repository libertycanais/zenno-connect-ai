// EPIC B — AI Execution Platform · Claude Adapter (analytical brain)
// Contract-compliant AIProviderAdapter for Anthropic Claude. Wraps a caller-
// supplied `invoker` function so it can be tested deterministically and so
// the real SDK wiring (via provider-layer) can be injected in a future Epic
// without changing this file's shape.
//
// This adapter NEVER embeds an SDK call directly — it delegates to the
// injected `invoker`, which lives in `src/providers/ai/*` in production.

import type { AIProviderAdapter, AdapterRequest, AdapterResponse } from "../provider-adapter";
import type { StreamEvent } from "../streaming";

export type ClaudeInvoker = (req: AdapterRequest) => Promise<AdapterResponse>;

export type ClaudeAdapterOptions = {
  providerId?: string;
  supportedModels?: readonly string[];
  invoker: ClaudeInvoker;
  ping?: () => Promise<{ ok: boolean; latencyMs: number; errorCode?: string }>;
};

const DEFAULT_MODELS = [
  "claude-3-5-sonnet-latest",
  "claude-3-5-haiku-latest",
  "claude-3-opus-latest",
] as const;

export class ClaudeAdapter implements AIProviderAdapter {
  readonly providerId: string;
  private readonly models: readonly string[];
  private readonly invoker: ClaudeInvoker;
  private readonly _ping: ClaudeAdapterOptions["ping"];

  constructor(opts: ClaudeAdapterOptions) {
    this.providerId = opts.providerId ?? "anthropic";
    this.models = opts.supportedModels ?? DEFAULT_MODELS;
    this.invoker = opts.invoker;
    this._ping = opts.ping;
  }

  supportsModel(modelId: string): boolean { return this.models.includes(modelId); }

  async execute(req: AdapterRequest): Promise<AdapterResponse> {
    return this.invoker(req);
  }

  async *stream(req: AdapterRequest): AsyncIterable<StreamEvent> {
    // Streaming path bridges to `execute` and emits a single content event,
    // preserving the contract without introducing SDK-specific streaming
    // until the real wiring lands.
    const res = await this.invoker(req);
    yield { kind: "start", provider: this.providerId, model: req.model };
    yield { kind: "delta", text: res.text };
    yield { kind: "usage", tokensIn: res.tokensIn, tokensOut: res.tokensOut };
    yield { kind: "end", reason: res.finishReason === "length" ? "length" : "stop" };
  }

  async ping(): Promise<{ ok: boolean; latencyMs: number; errorCode?: string }> {
    if (this._ping) return this._ping();
    return { ok: true, latencyMs: 0 };
  }
}
