import { describe, it, expect } from "vitest";
import { InMemoryTaskQueue } from "@/lib/ai/task-engine/queue";

describe("EPIC F · InMemoryTaskQueue", () => {
  it("executa tarefas em ordem de prioridade e reporta stats", async () => {
    const q = new InMemoryTaskQueue();
    const order: string[] = [];
    q.enqueue({ handler: async () => { order.push("low"); }, payload: null, priority: 8 });
    q.enqueue({ handler: async () => { order.push("high"); }, payload: null, priority: 2 });
    await q.runNext();
    await q.runNext();
    expect(order).toEqual(["high", "low"]);
    const s = q.stats();
    expect(s.succeeded).toBe(2);
  });

  it("faz retry com backoff exponencial em falhas", async () => {
    const q = new InMemoryTaskQueue();
    let attempts = 0;
    const t = q.enqueue({
      handler: async () => { attempts += 1; if (attempts < 2) throw new Error("boom"); },
      payload: null, maxRetries: 3, baseDelayMs: 1,
    });
    const r1 = await q.runNext(); // fails → reagenda
    expect(r1?.status).toBe("queued");
    await new Promise((r) => setTimeout(r, 5));
    const r2 = await q.runNext();
    expect(r2?.status).toBe("succeeded");
    expect(attempts).toBe(2);
    expect(q.get(t.id)?.attempts).toBe(2);
  });

  it("cancela tarefa antes da execução", async () => {
    const q = new InMemoryTaskQueue();
    const t = q.enqueue({ handler: async () => { throw new Error("should not run"); }, payload: null });
    expect(q.cancel(t.id)).toBe(true);
    const r = await q.runNext();
    expect(r).toBeNull();
    expect(q.get(t.id)?.status).toBe("cancelled");
  });

  it("deduplica via dedupeKey", () => {
    const q = new InMemoryTaskQueue();
    const a = q.enqueue({ handler: async () => {}, payload: null, dedupeKey: "k1" });
    const b = q.enqueue({ handler: async () => {}, payload: null, dedupeKey: "k1" });
    expect(a.id).toBe(b.id);
  });
});
