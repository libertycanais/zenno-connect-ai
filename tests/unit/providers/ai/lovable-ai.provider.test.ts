import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LovableAIProvider } from "@/providers/ai/lovable-ai.provider";
import {
  ProviderError,
  ProviderNotConfiguredError,
} from "@/providers/common/provider.types";
import { installFetchMock, type FetchMock } from "@tests/mocks/fetch";
import { makeTenantContext } from "@tests/helpers/tenant";

describe("LovableAIProvider", () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    vi.unstubAllEnvs();
    fetchMock = installFetchMock();
    vi.stubEnv("LOVABLE_API_KEY", "lov-test-key");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("has stable name", () => {
    expect(new LovableAIProvider().name).toBe("lovable");
  });

  it("chat requires LOVABLE_API_KEY", async () => {
    vi.stubEnv("LOVABLE_API_KEY", "");
    await expect(
      new LovableAIProvider().chat(makeTenantContext().providerContext, [
        { role: "user", content: "hi" },
      ]),
    ).rejects.toBeInstanceOf(ProviderNotConfiguredError);
  });

  it("chat parses content, tool_calls, usage", async () => {
    fetchMock.mockResponse("/chat/completions", {
      choices: [
        {
          message: {
            content: "hello",
            tool_calls: [
              { function: { name: "do_thing", arguments: '{"a":1}' } },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 3, completion_tokens: 2 },
    });
    const r = await new LovableAIProvider().chat(
      makeTenantContext().providerContext,
      [{ role: "user", content: "hi" }],
    );
    expect(r.content).toBe("hello");
    expect(r.toolCalls?.[0]).toEqual({ name: "do_thing", arguments: { a: 1 } });
    expect(r.usage).toEqual({ promptTokens: 3, completionTokens: 2 });
  });

  it("chat wraps gateway errors as ProviderError (no Authorization leak)", async () => {
    fetchMock.mockResponder("/chat/completions", () =>
      new Response(JSON.stringify({ error: { message: "bad model" } }), { status: 400 }),
    );
    try {
      await new LovableAIProvider().chat(makeTenantContext().providerContext, [
        { role: "user", content: "x" },
      ]);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ProviderError);
      const msg = (e as ProviderError).message;
      expect(msg).not.toContain("lov-test-key");
      expect(msg).not.toContain("Bearer lov-test-key");
    }
  });

  it("embeddings returns vectors + model", async () => {
    fetchMock.mockResponse("/embeddings", {
      data: [{ embedding: [0.1, 0.2] }],
    });
    const r = await new LovableAIProvider().embeddings(
      makeTenantContext().providerContext,
      { input: "hello" },
    );
    expect(r.vectors).toEqual([[0.1, 0.2]]);
    expect(r.model).toContain("text-embedding");
  });

  it("vision delegates to chat", async () => {
    fetchMock.mockResponse("/chat/completions", {
      choices: [{ message: { content: "a photo" } }],
    });
    const r = await new LovableAIProvider().vision(
      makeTenantContext().providerContext,
      { images: [{ url: "https://x/y.png" }], prompt: "describe" },
    );
    expect(r.content).toBe("a photo");
  });

  it("executeAction returns { ok: true, result: string }", async () => {
    fetchMock.mockResponse("/chat/completions", {
      choices: [{ message: { content: '{"ok":true}' } }],
    });
    const r = await new LovableAIProvider().executeAction(
      makeTenantContext().providerContext,
      { action: "noop", args: {} },
    );
    expect(r.ok).toBe(true);
    expect(typeof r.result).toBe("string");
  });
});
