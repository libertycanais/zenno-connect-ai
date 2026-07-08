/**
 * WS-7 — Rate limit functions behave correctly (no side-effects except
 * the row we insert into a keyed bucket, which is naturally bounded).
 */
import { describe, expect, it } from "vitest";
import { HAS_PG, psqlScalar } from "@tests/helpers/pg";

describe.skipIf(!HAS_PG)("WS-7 — rate-limit functions", () => {
  it("global_rate_limit_hit returns false on first call and true after exceeding limit", () => {
    const key = `ws7-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    // 3 calls with limit=2 → third one should exceed
    const r1 = psqlScalar(`select public.global_rate_limit_hit('${key}', 2, 60)`);
    const r2 = psqlScalar(`select public.global_rate_limit_hit('${key}', 2, 60)`);
    const r3 = psqlScalar(`select public.global_rate_limit_hit('${key}', 2, 60)`);
    expect(r1).toBe("f");
    expect(r2).toBe("f");
    expect(r3).toBe("t");
  });

  it("global_rate_limit_hit is a no-op on empty key", () => {
    const r = psqlScalar(`select public.global_rate_limit_hit('', 1, 60)`);
    expect(r).toBe("f");
  });

  it("track_compound_rate_limit_hit uses per-org buckets", () => {
    const org = "00000000-0000-4000-8000-000000000001";
    const key = `ws7-compound-${Date.now()}`;
    const r1 = psqlScalar(
      `select public.track_compound_rate_limit_hit('${org}', '${key}', 1, 60)`,
    );
    const r2 = psqlScalar(
      `select public.track_compound_rate_limit_hit('${org}', '${key}', 1, 60)`,
    );
    expect(r1).toBe("f");
    expect(r2).toBe("t");
  });

  it("global_rate_limits row is bounded by (key, window_start)", () => {
    const key = `ws7-uniq-${Date.now()}`;
    psqlScalar(`select public.global_rate_limit_hit('${key}', 10, 60)`);
    psqlScalar(`select public.global_rate_limit_hit('${key}', 10, 60)`);
    const cnt = psqlScalar(
      `select count(*)::int from public.global_rate_limits where key='${key}'`,
    );
    expect(cnt).toBe("1");
  });
});
