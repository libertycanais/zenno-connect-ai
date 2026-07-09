import { describe, it, expect } from "vitest";
import { AutomationRegistry } from "@/lib/ai/automation/triggers";
import { InflightDedup } from "@/lib/ai/perf/dedup";

describe("EPIC F · AutomationRegistry", () => {
  it("dispara apenas handlers correspondentes ao evento e org", async () => {
    const reg = new AutomationRegistry();
    let a = 0; let b = 0;
    reg.register({ id: "r1", organizationId: "org1", kind: "metrics.updated", handler: () => { a++; }, active: true });
    reg.register({ id: "r2", organizationId: "org2", kind: "metrics.updated", handler: () => { b++; }, active: true });
    const res = await reg.emit({ kind: "metrics.updated", organizationId: "org1", payload: {}, emittedAt: Date.now() });
    expect(res.matched).toBe(1);
    expect(a).toBe(1); expect(b).toBe(0);
  });

  it("captura erros do handler sem quebrar o loop", async () => {
    const reg = new AutomationRegistry();
    reg.register({ id: "bad", organizationId: "org1", kind: "manual", handler: () => { throw new Error("x"); }, active: true });
    const res = await reg.emit({ kind: "manual", organizationId: "org1", payload: {}, emittedAt: Date.now() });
    expect(res.errors).toBe(1);
  });
});

describe("EPIC F · InflightDedup", () => {
  it("coalesce chamadas concorrentes com a mesma chave", async () => {
    const d = new InflightDedup<number>(1000);
    let calls = 0;
    const fn = async () => { calls++; await new Promise((r) => setTimeout(r, 5)); return 42; };
    const [a, b] = await Promise.all([d.run("k", fn), d.run("k", fn)]);
    expect(a).toBe(42); expect(b).toBe(42);
    expect(calls).toBe(1);
  });

  it("respeita TTL de cache", async () => {
    const d = new InflightDedup<number>(1);
    let calls = 0;
    const fn = async () => { calls++; return calls; };
    await d.run("k", fn);
    await new Promise((r) => setTimeout(r, 5));
    await d.run("k", fn);
    expect(calls).toBe(2);
  });
});
