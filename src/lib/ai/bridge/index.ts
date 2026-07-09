// EPIC B — AI Execution Platform · Provider Adapter Bridge
// Uniform, resilient invocation of an AIProviderAdapter. Wraps every call
// with Circuit Breaker + Retry + Timeout. NEVER bypasses the adapter contract.

import { withRetry, DEFAULT_RETRY, type RetryPolicy } from "../resilience/retry";
import { circuitBreaker, breakerKey } from "../resilience";
import type { AIProviderAdapter, AdapterRequest, AdapterResponse } from "../provider-adapter";
import { normalizeAIError } from "../errors";

export type BridgeInvokeOptions = {
  timeoutMs?: number;
  retryPolicy?: RetryPolicy;
  signal?: AbortSignal;
};

export type BridgeInvokeResult = {
  response: AdapterResponse | null;
  attempts: number;
  latencyMs: number;
  breakerTripped: boolean;
  error: string | null;
};

export class ProviderBridge {
  constructor(private readonly adapters: Map<string, AIProviderAdapter> = new Map()) {}

  register(adapter: AIProviderAdapter): void {
    this.adapters.set(adapter.providerId, adapter);
  }

  get(providerId: string): AIProviderAdapter | undefined {
    return this.adapters.get(providerId);
  }

  has(providerId: string): boolean { return this.adapters.has(providerId); }

  async invoke(
    providerId: string, model: string, req: Omit<AdapterRequest, "model" | "signal">,
    options: BridgeInvokeOptions = {},
  ): Promise<BridgeInvokeResult> {
    const adapter = this.adapters.get(providerId);
    if (!adapter) return { response: null, attempts: 0, latencyMs: 0, breakerTripped: false, error: `unknown_provider:${providerId}` };
    if (!adapter.supportsModel(model)) return { response: null, attempts: 0, latencyMs: 0, breakerTripped: false, error: `unsupported_model:${model}` };

    const bkey = breakerKey(providerId, model);
    if (circuitBreaker.isOpen(bkey)) {
      return { response: null, attempts: 0, latencyMs: 0, breakerTripped: true, error: "circuit_open" };
    }

    const start = Date.now();
    let attempts = 0;
    const timeoutMs = options.timeoutMs ?? 30_000;
    const policy = options.retryPolicy ?? DEFAULT_RETRY;

    try {
      const response = await withRetry(async (attempt) => {
        attempts = attempt;
        const ac = new AbortController();
        const merged = mergeSignals(ac.signal, options.signal);
        const timer = setTimeout(() => ac.abort(), timeoutMs);
        try {
          const out = await adapter.execute({ ...req, model, signal: merged });
          circuitBreaker.onSuccess(bkey);
          return out;
        } catch (err) {
          circuitBreaker.onFailure(bkey);
          throw err;
        } finally {
          clearTimeout(timer);
        }
      }, policy, { signal: options.signal });
      return { response, attempts, latencyMs: Date.now() - start, breakerTripped: false, error: null };
    } catch (err) {
      const n = normalizeAIError(err);
      return {
        response: null, attempts, latencyMs: Date.now() - start,
        breakerTripped: circuitBreaker.isOpen(bkey),
        error: n.code,
      };
    }
  }
}

function mergeSignals(a: AbortSignal, b?: AbortSignal): AbortSignal {
  if (!b) return a;
  const ac = new AbortController();
  const onA = () => ac.abort();
  const onB = () => ac.abort();
  a.addEventListener("abort", onA, { once: true });
  b.addEventListener("abort", onB, { once: true });
  if (a.aborted || b.aborted) ac.abort();
  return ac.signal;
}

export const providerBridge = new ProviderBridge();
