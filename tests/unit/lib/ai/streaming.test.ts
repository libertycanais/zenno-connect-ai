// P0.6 · Onda 3 — Streaming Engine
import { describe, expect, it } from "vitest";
import { collectStream, toSSE, toSSEResponse, type StreamEvent } from "@/lib/ai/streaming";

async function* gen(evs: StreamEvent[]): AsyncIterable<StreamEvent> {
  for (const e of evs) yield e;
}

describe("Streaming Engine", () => {
  it("collectStream aggregates deltas + usage + end reason", async () => {
    const events: StreamEvent[] = [
      { kind: "start", provider: "openai", model: "gpt-5.5" },
      { kind: "delta", text: "Hello " },
      { kind: "delta", text: "world" },
      { kind: "reasoning", text: "internal" },
      { kind: "usage", tokensIn: 10, tokensOut: 4 },
      { kind: "end", reason: "stop" },
    ];
    const r = await collectStream(gen(events));
    expect(r.text).toBe("Hello world");
    expect(r.reasoning).toBe("internal");
    expect(r.tokensIn).toBe(10);
    expect(r.tokensOut).toBe(4);
    expect(r.endReason).toBe("stop");
  });

  it("captures error events without throwing", async () => {
    const r = await collectStream(gen([
      { kind: "error", code: "RATE_LIMITED", message: "slow down" },
      { kind: "end", reason: "error" },
    ]));
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]!.code).toBe("RATE_LIMITED");
  });

  it("toSSE serializes to event/data lines", () => {
    const s = toSSE({ kind: "delta", text: "hi" });
    expect(s).toMatch(/^event: delta\ndata: \{.*\}\n\n$/);
  });

  it("toSSEResponse returns text/event-stream", async () => {
    const res = toSSEResponse(gen([{ kind: "end", reason: "stop" }]));
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const body = await res.text();
    expect(body).toContain("event: end");
  });
});
