// EPIC E — Real Claude Adapter (invoker) — offline unit test.
// Validates: request shape, header injection, token accounting, error surface.
// Uses a mocked fetch — never touches the network.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { encryptApiKey } from "@/lib/ai/crypto.server";
import { buildClaudeInvoker, type ClaudeCredential } from "@/lib/ai/adapters/claude-real-adapter.server";

process.env.AI_ENCRYPTION_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function makeCred(): ClaudeCredential {
  const enc = encryptApiKey("sk-ant-test-1234567890");
  return {
    organizationId: "org1",
    provider: "anthropic",
    ciphertext: enc.ciphertext,
    nonce: enc.nonce,
    defaultModel: "claude-3-5-sonnet-latest",
    maxTokens: 1024,
    temperature: 0.4,
    timeoutMs: 30_000,
    fingerprint: enc.fingerprint,
    last4: enc.last4,
  };
}

describe("EPIC E · claude-real-adapter", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("emits Anthropic-compliant request and parses response", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response(
      JSON.stringify({
        content: [{ type: "text", text: "hello world" }],
        usage: { input_tokens: 12, output_tokens: 3 },
        stop_reason: "end_turn",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));

    const invoker = buildClaudeInvoker(makeCred());
    const res = await invoker({
      model: "claude-3-5-sonnet-latest",
      systemPrompt: "You are Zenno.",
      userPrompt: "hi",
      signal: new AbortController().signal,
    });

    expect(res.text).toBe("hello world");
    expect(res.tokensIn).toBe(12);
    expect(res.tokensOut).toBe(3);
    expect(res.finishReason).toBe("stop");

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toContain("anthropic.com");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["anthropic-version"]).toBeTruthy();
    expect(headers["x-api-key"]).toBe("sk-ant-test-1234567890");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe("claude-3-5-sonnet-latest");
    expect(body.system).toBe("You are Zenno.");
    expect(body.messages[0]).toEqual({ role: "user", content: "hi" });
  });

  it("surfaces HTTP errors with status code", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response("boom", { status: 500 }));
    const invoker = buildClaudeInvoker(makeCred());
    await expect(invoker({
      model: "claude-3-5-sonnet-latest",
      systemPrompt: "s", userPrompt: "u",
      signal: new AbortController().signal,
    })).rejects.toThrow(/anthropic_http_500/);
  });

  it("propagates network errors", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("ECONNRESET"));
    const invoker = buildClaudeInvoker(makeCred());
    await expect(invoker({
      model: "claude-3-5-sonnet-latest",
      systemPrompt: "s", userPrompt: "u",
      signal: new AbortController().signal,
    })).rejects.toThrow(/ECONNRESET/);
  });
});
