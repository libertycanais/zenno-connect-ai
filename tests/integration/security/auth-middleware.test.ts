/**
 * WS-6 — requireSupabaseAuth
 * Prova que o middleware bloqueia chamadas sem/ com Bearer inválido
 * e que sempre requer SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

async function loadMiddleware() {
  return await import("@/integrations/supabase/auth-middleware");
}

function stubRequest(headers: Record<string, string> | null) {
  vi.doMock("@tanstack/react-start/server", () => ({
    getRequest: () =>
      headers === null
        ? null
        : new Request("http://localhost/x", { headers }),
  }));
}

function stubSupabaseClient(claims: unknown, error: unknown = null) {
  vi.doMock("@supabase/supabase-js", () => ({
    createClient: () => ({
      auth: {
        getClaims: async () => ({ data: claims ? { claims } : null, error }),
      },
    }),
  }));
}

async function runMiddleware() {
  const { requireSupabaseAuth } = await loadMiddleware();
  // Access private server handler via .server(next)
  const impl = (requireSupabaseAuth as unknown as {
    _def?: { server?: (arg: { next: (v: unknown) => unknown }) => unknown };
    // Real API uses .server chained callback — invoke through options
    options?: { server?: (arg: { next: (v: unknown) => unknown }) => unknown };
  });
  // TanStack middleware exposes internal via `.options.server` in current version.
  const server =
    impl.options?.server ?? impl._def?.server ?? (impl as unknown as (a: unknown) => unknown);
  return await (server as (arg: { next: (v: unknown) => unknown }) => unknown)({
    next: (v) => v,
  });
}

describe("requireSupabaseAuth middleware — WS-6", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.SUPABASE_URL = "http://sb.local";
    process.env.SUPABASE_PUBLISHABLE_KEY = "pk_test";
  });
  afterEach(() => {
    vi.doUnmock("@tanstack/react-start/server");
    vi.doUnmock("@supabase/supabase-js");
    process.env = { ...originalEnv };
  });

  it("throws when SUPABASE_URL missing", async () => {
    delete process.env.SUPABASE_URL;
    stubRequest({ authorization: "Bearer x" });
    stubSupabaseClient({ sub: "u1" });
    await expect(runMiddleware()).rejects.toThrow(/SUPABASE_URL/);
  });

  it("throws when SUPABASE_PUBLISHABLE_KEY missing", async () => {
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    stubRequest({ authorization: "Bearer x" });
    stubSupabaseClient({ sub: "u1" });
    await expect(runMiddleware()).rejects.toThrow(/SUPABASE_PUBLISHABLE_KEY/);
  });

  it("throws Unauthorized when no request headers available", async () => {
    stubRequest(null);
    stubSupabaseClient({ sub: "u1" });
    await expect(runMiddleware()).rejects.toThrow(/Unauthorized/);
  });

  it("throws when Authorization header missing", async () => {
    stubRequest({});
    stubSupabaseClient({ sub: "u1" });
    await expect(runMiddleware()).rejects.toThrow(/No authorization header/);
  });

  it("throws when scheme is not Bearer", async () => {
    stubRequest({ authorization: "Basic abcdef" });
    stubSupabaseClient({ sub: "u1" });
    await expect(runMiddleware()).rejects.toThrow(/Only Bearer/);
  });

  it("throws when Bearer token is empty", async () => {
    stubRequest({ authorization: "Bearer " });
    stubSupabaseClient({ sub: "u1" });
    await expect(runMiddleware()).rejects.toThrow(/No token/);
  });

  it("throws when getClaims returns error", async () => {
    stubRequest({ authorization: "Bearer bad" });
    stubSupabaseClient(null, { message: "invalid" });
    await expect(runMiddleware()).rejects.toThrow(/Invalid token/);
  });

  it("throws when claims have no sub", async () => {
    stubRequest({ authorization: "Bearer ok" });
    stubSupabaseClient({ email: "x@y.z" });
    await expect(runMiddleware()).rejects.toThrow(/No user ID/);
  });

  it("passes through context with userId + claims + supabase when Bearer is valid", async () => {
    stubRequest({ authorization: "Bearer good" });
    stubSupabaseClient({ sub: "user-123", email: "a@b.c" });
    const ctx = (await runMiddleware()) as {
      context: { userId: string; claims: { sub: string }; supabase: unknown };
    };
    expect(ctx.context.userId).toBe("user-123");
    expect(ctx.context.claims.sub).toBe("user-123");
    expect(ctx.context.supabase).toBeDefined();
  });
});
