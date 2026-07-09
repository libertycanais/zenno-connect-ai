import { describe, expect, it } from "vitest";
import { MockProviderAdapter } from "@/lib/ai/adapters/mock-adapter";
import { collectStream } from "@/lib/ai/streaming";

function req(overrides: Partial<Parameters<MockProviderAdapter["execute"]>[0]> = {}) {
  return {
    model: "mock-fast",
    systemPrompt: "s",
    userPrompt: "u",
    signal: new AbortController().signal,
    ...overrides,
  };
}

describe("MockProviderAdapter", () => {
  it("returns scripted text response", async () => {
    const a = new MockProviderAdapter({ scripts: [{ kind: "text", text: "hello world" }] });
    const r = await a.execute(req());
    expect(r.text).toBe("hello world");
    expect(r.finishReason).toBe("stop");
    expect(r.tokensOut).toBeGreaterThan(0);
  });

  it("throws scripted error", async () => {
    const a = new MockProviderAdapter({ scripts: [{ kind: "error", status: 429, message: "rate limited" }] });
    await expect(a.execute(req())).rejects.toMatchObject({ status: 429 });
  });

  it("streams delta chunks and closes with end event", async () => {
    const a = new MockProviderAdapter({ scripts: [{ kind: "text", text: "abcdefghij" }] });
    const collected = await collectStream(a.stream(req()));
    expect(collected.text).toBe("abcdefghij");
    expect(collected.endReason).toBe("stop");
  });

  it("emits tool_call event on scripted toolCall", async () => {
    const a = new MockProviderAdapter({
      scripts: [{ kind: "toolCall", call: { id: "t1", name: "search", args: { q: "x" } } }],
    });
    const events: string[] = [];
    for await (const ev of a.stream(req())) events.push(ev.kind);
    expect(events).toContain("tool_call");
    expect(events[events.length - 1]).toBe("end");
  });

  it("respects abort signal during streaming", async () => {
    const ac = new AbortController();
    const a = new MockProviderAdapter({
      scripts: [{ kind: "text", text: "x".repeat(80) }],
    });
    ac.abort();
    const collected = await collectStream(a.stream(req({ signal: ac.signal })));
    expect(collected.endReason).toBe("abort");
  });

  it("supportsModel filters by declared list", () => {
    const a = new MockProviderAdapter({ supportedModels: ["only-this"] });
    expect(a.supportsModel("only-this")).toBe(true);
    expect(a.supportsModel("nope")).toBe(false);
  });

  it("ping always ok", async () => {
    const r = await new MockProviderAdapter().ping();
    expect(r.ok).toBe(true);
  });
});
