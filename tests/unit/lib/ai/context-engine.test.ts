// P0.6 · Onda 2 — Context Engine tests (cache, budget, assembler, cross-tenant)
import { describe, expect, it, vi } from "vitest";
import {
  assembleBusinessContext,
  buildUserPromptFromContext,
  createInMemoryContextCache,
  CONTEXT_TTL,
  estimateTokens,
  mergeMemorySlices,
  nullReaders,
  reduceContext,
  trimConversation,
  truncateLists,
  type BusinessContext,
  type ContextReaders,
  type MemorySlice,
} from "@/lib/ai/context";

const scope = { organizationId: "org-A", userId: "user-1", agent: "free_chat" as const };

function makeReaders(overrides: Partial<ContextReaders> = {}): ContextReaders {
  return { ...nullReaders, ...overrides };
}

describe("ContextCache", () => {
  it("returns undefined before set and value after set", () => {
    const c = createInMemoryContextCache();
    expect(c.get("org", "billing")).toBeUndefined();
    c.set("org", "billing", { hello: 1 }, 60);
    expect(c.get("org", "billing")).toEqual({ hello: 1 });
  });

  it("respects TTL expiration", () => {
    let t = 1_000_000;
    const c = createInMemoryContextCache(() => t);
    c.set("org", "billing", { x: 1 }, 5);
    expect(c.get("org", "billing")).toEqual({ x: 1 });
    t += 6_000;
    expect(c.get("org", "billing")).toBeUndefined();
  });

  it("isolates by org", () => {
    const c = createInMemoryContextCache();
    c.set("orgA", "billing", { plan: "pro" }, 60);
    expect(c.get("orgB", "billing")).toBeUndefined();
  });

  it("invalidates a single module or the whole org", () => {
    const c = createInMemoryContextCache();
    c.set("org", "billing", { a: 1 }, 60);
    c.set("org", "crm", { b: 2 }, 60);
    c.invalidate("org", "billing");
    expect(c.get("org", "billing")).toBeUndefined();
    expect(c.get("org", "crm")).toEqual({ b: 2 });
    c.invalidate("org");
    expect(c.get("org", "crm")).toBeUndefined();
  });

  it("has module TTLs matching Wave 2 spec", () => {
    expect(CONTEXT_TTL.organization).toBe(24 * 3600);
    expect(CONTEXT_TTL.executive).toBe(60);
    expect(CONTEXT_TTL.tracking).toBe(120);
  });
});

describe("Token Budget", () => {
  it("estimateTokens ~= ceil(chars/4)", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("a".repeat(400))).toBe(100);
  });

  it("truncateLists caps arrays", () => {
    const out = truncateLists({ items: [1, 2, 3, 4, 5, 6, 7, 8], name: "x" }, 3);
    expect(out.items).toHaveLength(3);
    expect(out.name).toBe("x");
  });

  it("drops low-priority modules when budget is tight", async () => {
    const ctx = await assembleBusinessContext(scope, {
      readers: makeReaders({
        organization: async () => ({
          id: "o", name: "Acme", locale: "pt-BR", timezone: "UTC", currency: "BRL",
          industry: null, productLines: [],
        }),
        team: async () => ({
          totalMembers: 10, activeMembers: 8, pendingInvitations: 2,
          roles: { owner: 1, admin: 2 }, currentUserRole: "owner",
        }),
        executive: async () => ({
          mrrCents: 100000, arrCents: 1200000, activeCustomers: 42,
          churnRate: 0.02, conversionRate: 0.1, cacCents: 5000, ltvCents: 200000, roi: 3.5,
        }),
      }),
      cache: createInMemoryContextCache(),
    });
    const tight = reduceContext(ctx, 20);
    expect(tight.plan.included.length).toBeGreaterThan(0);
    expect(tight.plan.dropped.length).toBeGreaterThan(0);
    expect(tight.plan.totalTokens).toBeLessThanOrEqual(20);
  });

  it("reduceContext includes all when budget is generous", async () => {
    const ctx = await assembleBusinessContext(scope, {
      readers: makeReaders({
        organization: async () => ({
          id: "o", name: "A", locale: "pt-BR", timezone: "UTC", currency: "BRL",
          industry: null, productLines: [],
        }),
      }),
      cache: createInMemoryContextCache(),
    });
    const generous = reduceContext(ctx, 100_000);
    expect(generous.plan.dropped).toContain("billing"); // null slice dropped
    expect(generous.plan.included).toContain("organization");
  });
});

describe("assembleBusinessContext", () => {
  it("throws when scope is invalid", async () => {
    await expect(
      assembleBusinessContext({ organizationId: "", userId: "u", agent: "free_chat" }, {
        readers: nullReaders, cache: createInMemoryContextCache(),
      }),
    ).rejects.toThrow();
  });

  it("runs all readers in parallel exactly once", async () => {
    const billing = vi.fn().mockResolvedValue(null);
    const crm = vi.fn().mockResolvedValue(null);
    await assembleBusinessContext(scope, {
      readers: makeReaders({ billing, crm }),
      cache: createInMemoryContextCache(),
    });
    expect(billing).toHaveBeenCalledTimes(1);
    expect(crm).toHaveBeenCalledTimes(1);
  });

  it("falls back to null when a reader throws", async () => {
    const ctx = await assembleBusinessContext(scope, {
      readers: makeReaders({
        billing: async () => { throw new Error("boom"); },
      }),
      cache: createInMemoryContextCache(),
    });
    expect(ctx.billing.data).toBeNull();
    expect(ctx.billing.meta.freshness).toBe("missing");
    expect(ctx.billing.meta.confidence).toBe(0);
  });

  it("populates provenance metadata on every slice", async () => {
    const ctx = await assembleBusinessContext(scope, {
      readers: makeReaders({
        organization: async () => ({
          id: "o", name: "N", locale: "pt-BR", timezone: "UTC", currency: "BRL",
          industry: null, productLines: [],
        }),
      }),
      cache: createInMemoryContextCache(),
    });
    expect(ctx.organization.meta.source).toBe("zenno.context.organization");
    expect(ctx.organization.meta.confidence).toBeGreaterThan(0);
    expect(ctx.organization.meta.ttlSeconds).toBe(CONTEXT_TTL.organization);
    expect(ctx.organization.meta.freshness).toBe("fresh");
  });

  it("reuses cached modules on second call (marked stale)", async () => {
    const cache = createInMemoryContextCache();
    const org = vi.fn().mockResolvedValue({
      id: "o", name: "A", locale: "pt-BR", timezone: "UTC", currency: "BRL",
      industry: null, productLines: [],
    });
    const readers = makeReaders({ organization: org });
    await assembleBusinessContext(scope, { readers, cache });
    const second = await assembleBusinessContext(scope, { readers, cache });
    expect(org).toHaveBeenCalledTimes(1);
    expect(second.organization.meta.freshness).toBe("stale");
  });

  it("keeps org A and org B contexts isolated", async () => {
    const cache = createInMemoryContextCache();
    const readers = makeReaders({
      organization: async ({ organizationId }) => ({
        id: organizationId, name: `Name-${organizationId}`, locale: "pt-BR",
        timezone: "UTC", currency: "BRL", industry: null, productLines: [],
      }),
    });
    const a = await assembleBusinessContext({ ...scope, organizationId: "org-A" }, { readers, cache });
    const b = await assembleBusinessContext({ ...scope, organizationId: "org-B" }, { readers, cache });
    expect(a.organization.data?.name).toBe("Name-org-A");
    expect(b.organization.data?.name).toBe("Name-org-B");
  });
});

describe("Memory merge & conversation trim", () => {
  it("mergeMemorySlices dedupes on key preferring the newer entry", () => {
    const a: MemorySlice = {
      objectives: [{ key: "goal", value: { v: 1 } }],
      preferences: [], restrictions: [], insights: [],
    };
    const b: MemorySlice = {
      objectives: [{ key: "goal", value: { v: 2 } }, { key: "other", value: { v: 9 } }],
      preferences: [], restrictions: [], insights: [],
    };
    const merged = mergeMemorySlices(a, b);
    expect(merged.objectives).toHaveLength(2);
    expect(merged.objectives.find((e) => e.key === "goal")?.value).toEqual({ v: 2 });
  });

  it("trimConversation keeps only the last N turns", () => {
    const turns = Array.from({ length: 10 }, (_, i) => ({
      role: "user" as const, content: `t${i}`, at: new Date(i * 1000).toISOString(),
    }));
    const trimmed = trimConversation({ conversationId: null, turnCount: 10, recentTurns: turns }, 3);
    expect(trimmed.recentTurns.map((t) => t.content)).toEqual(["t7", "t8", "t9"]);
  });
});

describe("buildUserPromptFromContext", () => {
  it("wraps context in untrusted blocks and reports budget usage", async () => {
    const ctx = await assembleBusinessContext(scope, {
      readers: makeReaders({
        organization: async () => ({
          id: "o", name: "Acme", locale: "pt-BR", timezone: "UTC",
          currency: "BRL", industry: "SaaS", productLines: ["Zenno"],
        }),
      }),
      cache: createInMemoryContextCache(),
    });
    const built = buildUserPromptFromContext({
      businessContext: ctx as BusinessContext,
      userInput: "Como vamos de MRR?",
      maxContextTokens: 5_000,
    });
    expect(built.prompt).toContain('<untrusted source="organization">');
    expect(built.prompt).toContain("<user_request>");
    expect(built.prompt).toContain("Como vamos de MRR?");
    expect(built.totalContextTokens).toBeGreaterThan(0);
    expect(built.droppedModules.length).toBeGreaterThan(0); // most slices are null
  });
});
