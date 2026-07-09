// P0.6 · Onda 3 — Health Monitor
import { describe, expect, it } from "vitest";
import { ProviderHealthMonitor } from "@/lib/ai/health";

describe("Provider Health Monitor", () => {
  it("empty state is online with samples=0", () => {
    const h = new ProviderHealthMonitor().snapshot("openai");
    expect(h.status).toBe("online");
    expect(h.samples).toBe(0);
    expect(h.uptime01).toBe(1);
  });

  it("marks offline when all samples fail", () => {
    const m = new ProviderHealthMonitor();
    const now = Date.now();
    for (let i = 0; i < 5; i++) m.record({ providerId: "openai", ok: false, latencyMs: 100, timestampMs: now, errorCode: "5xx" });
    const s = m.snapshot("openai");
    expect(s.status).toBe("offline");
    expect(s.uptime01).toBe(0);
    expect(s.lastError).toBe("5xx");
  });

  it("marks degraded when uptime < 0.8", () => {
    const m = new ProviderHealthMonitor();
    const now = Date.now();
    for (let i = 0; i < 4; i++) m.record({ providerId: "x", ok: false, latencyMs: 100, timestampMs: now });
    for (let i = 0; i < 6; i++) m.record({ providerId: "x", ok: true, latencyMs: 100, timestampMs: now });
    expect(m.snapshot("x").status).toBe("degraded");
  });

  it("marks degraded when latency very high", () => {
    const m = new ProviderHealthMonitor();
    const now = Date.now();
    for (let i = 0; i < 5; i++) m.record({ providerId: "y", ok: true, latencyMs: 20_000, timestampMs: now });
    expect(m.snapshot("y").status).toBe("degraded");
  });

  it("snapshotAll returns all tracked providers", () => {
    const m = new ProviderHealthMonitor();
    m.record({ providerId: "a", ok: true, latencyMs: 10, timestampMs: Date.now() });
    m.record({ providerId: "b", ok: true, latencyMs: 20, timestampMs: Date.now() });
    expect([...m.snapshotAll().keys()].sort()).toEqual(["a", "b"]);
  });
});
