// EPIC E — Real Claude Adapter (SERVER ONLY).
// Reads encrypted credentials from ai_provider_credentials, decrypts in-memory
// and invokes the Anthropic Messages API via fetch. Every call goes through
// the Provider Bridge (Circuit Breaker + Retry + Timeout).
//
// This module NEVER runs on the client. Do not import at module scope from a
// *.functions.ts file — import it lazily inside a server handler.

import { ClaudeAdapter, type ClaudeInvoker } from "./claude-adapter";
import type { AdapterRequest, AdapterResponse } from "../provider-adapter";
import { decryptApiKey } from "../crypto.server";
import { log } from "@/lib/logger";
import { incCounter, observe } from "@/lib/observability";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export type ClaudeCredential = {
  organizationId: string;
  provider: string;                  // "anthropic"
  ciphertext: Buffer | string;
  nonce: Buffer | string;
  defaultModel: string | null;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
  fingerprint: string;
  last4: string;
};

function toBuffer(v: Buffer | string): Buffer {
  if (Buffer.isBuffer(v)) return v;
  // Supabase serialises bytea as `\x...` hex.
  if (typeof v === "string" && v.startsWith("\\x")) return Buffer.from(v.slice(2), "hex");
  return Buffer.from(v, "base64");
}

/**
 * Build a real ClaudeInvoker bound to a decrypted credential.
 * Cost / usage / errors are surfaced via observability metrics; the raw key
 * never leaves this closure.
 */
export function buildClaudeInvoker(cred: ClaudeCredential): ClaudeInvoker {
  const apiKey = decryptApiKey(toBuffer(cred.ciphertext), toBuffer(cred.nonce));
  return async (req: AdapterRequest): Promise<AdapterResponse> => {
    const started = Date.now();
    const body = {
      model: req.model,
      max_tokens: req.maxOutputTokens ?? cred.maxTokens,
      temperature: req.temperature ?? cred.temperature,
      system: req.systemPrompt,
      messages: [{ role: "user", content: req.userPrompt }],
    };
    let res: Response;
    try {
      res = await fetch(ANTHROPIC_URL, {
        method: "POST",
        signal: req.signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      metrics.increment("ai.provider.error", { provider: "anthropic", kind: "network" });
      logger.error("claude.fetch_failed", { fingerprint: cred.fingerprint, err: String(err) });
      throw err;
    }
    const latencyMs = Date.now() - started;
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      metrics.increment("ai.provider.error", { provider: "anthropic", kind: `http_${res.status}` });
      logger.warn("claude.non_ok", { status: res.status, latencyMs, fingerprint: cred.fingerprint });
      throw new Error(`anthropic_http_${res.status}: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
      stop_reason?: string;
    };
    const text = (json.content ?? [])
      .filter((c) => c.type === "text" && typeof c.text === "string")
      .map((c) => c.text as string).join("");
    const tokensIn = json.usage?.input_tokens ?? 0;
    const tokensOut = json.usage?.output_tokens ?? 0;
    metrics.observe("ai.provider.latency_ms", latencyMs, { provider: "anthropic" });
    metrics.increment("ai.provider.tokens_in", { provider: "anthropic" }, tokensIn);
    metrics.increment("ai.provider.tokens_out", { provider: "anthropic" }, tokensOut);
    return {
      text,
      toolCalls: [],
      tokensIn,
      tokensOut,
      finishReason: json.stop_reason === "max_tokens" ? "length" : "stop",
    };
  };
}

/** Convenience factory: assemble a ClaudeAdapter wired to real credentials. */
export function createRealClaudeAdapter(cred: ClaudeCredential): ClaudeAdapter {
  return new ClaudeAdapter({
    providerId: "anthropic",
    invoker: buildClaudeInvoker(cred),
    ping: async () => ({ ok: true, latencyMs: 0 }),
  });
}
