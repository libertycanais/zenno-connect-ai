// P0.6 · Onda 1 — Cache key helpers + Memory validators
import { describe, expect, it } from "vitest";
import { buildCacheKey, computeExpiresAt, isExpired } from "@/lib/ai/cache";
import { isValidScope, validateMemoryEntry } from "@/lib/ai/memory";

describe("cache helpers", () => {
  it("buildCacheKey is deterministic and length-bounded", () => {
    const a = buildCacheKey(["org-1", "campaign_analyst", null, 30]);
    const b = buildCacheKey(["org-1", "campaign_analyst", null, 30]);
    expect(a).toBe(b);
    expect(a).toHaveLength(40);
  });

  it("different inputs produce different keys", () => {
    expect(buildCacheKey(["a"])).not.toBe(buildCacheKey(["b"]));
  });

  it("computeExpiresAt clamps to [1, 86400] seconds", () => {
    const base = new Date("2026-01-01T00:00:00Z");
    expect(computeExpiresAt(0, base).getTime()).toBe(base.getTime() + 1000);
    expect(computeExpiresAt(999_999, base).getTime()).toBe(base.getTime() + 86_400_000);
  });

  it("isExpired detects past dates", () => {
    expect(isExpired(new Date(Date.now() - 1000))).toBe(true);
    expect(isExpired(new Date(Date.now() + 10_000))).toBe(false);
  });
});

describe("memory validators", () => {
  it("accepts known scopes", () => {
    expect(isValidScope("objectives")).toBe(true);
    expect(isValidScope("bogus")).toBe(false);
  });

  it("rejects entries with invalid scope", () => {
    const r = validateMemoryEntry({ scope: "bogus" as never, key: "k", value: {} });
    expect(r.ok).toBe(false);
  });

  it("rejects empty key", () => {
    const r = validateMemoryEntry({ scope: "objectives", key: "", value: {} });
    expect(r.ok).toBe(false);
  });

  it("rejects confidence outside [0,1]", () => {
    const r = validateMemoryEntry({ scope: "objectives", key: "k", value: {}, confidence: 1.5 });
    expect(r.ok).toBe(false);
  });

  it("accepts valid entry", () => {
    const r = validateMemoryEntry({ scope: "products", key: "sku-1", value: { name: "x" }, confidence: 0.9 });
    expect(r.ok).toBe(true);
  });
});
