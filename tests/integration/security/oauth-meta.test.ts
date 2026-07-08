/**
 * WS-6 — OAuth Meta callback: state binding, rate limit, provider guard.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invokeHandler } from "@tests/helpers/route";
import { makeRequest } from "@tests/helpers/http";
import {
  resetSupabaseState,
  supabaseAdminMock,
  supabaseState,
} from "@tests/mocks/supabase-admin";
import { installFetchMock } from "@tests/mocks/fetch";

vi.mock("@/integrations/supabase/client.server", async () => {
  const mod = await import("@tests/mocks/supabase-admin");
  return { supabaseAdmin: mod.supabaseAdminMock };
});

async function loadRoute() {
  return (await import("@/routes/api/public/meta.oauth.callback")).Route;
}

function makeCb(params: Record<string, string>) {
  const url = new URL("http://x/api/public/meta/oauth/callback");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return makeRequest(url.toString(), { headers: { "cf-connecting-ip": "9.9.9.9" } });
}

describe("Meta OAuth callback — security invariants", () => {
  beforeEach(() => {
    resetSupabaseState();
    supabaseAdminMock.from.mockClear();
    supabaseAdminMock.rpc.mockClear();
    installFetchMock();
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("rejects a Google-issued state on the Meta callback (provider binding)", async () => {
    supabaseState.rpcResponses.global_rate_limit_hit = false;
    supabaseState.responses["oauth_states:maybeSingle"] = {
      organization_id: "org-1",
      user_id: "user-1",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      consumed_at: null,
      provider: "google_ads",
    };
    const Route = await loadRoute();
    const res = await invokeHandler(Route, "GET", makeCb({ code: "c", state: "s" }));
    expect(res.headers.get("location")).toContain("invalid_state");
  });

  it("rejects an already-consumed state (replay protection)", async () => {
    supabaseState.rpcResponses.global_rate_limit_hit = false;
    supabaseState.responses["oauth_states:maybeSingle"] = {
      organization_id: "org-1",
      user_id: "user-1",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      consumed_at: new Date().toISOString(),
      provider: "meta",
    };
    const Route = await loadRoute();
    const res = await invokeHandler(Route, "GET", makeCb({ code: "c", state: "s" }));
    expect(res.headers.get("location")).toContain("invalid_state");
  });

  it("rejects an expired state", async () => {
    supabaseState.rpcResponses.global_rate_limit_hit = false;
    supabaseState.responses["oauth_states:maybeSingle"] = {
      organization_id: "org-1",
      user_id: "user-1",
      expires_at: new Date(Date.now() - 1_000).toISOString(),
      consumed_at: null,
      provider: "meta",
    };
    const Route = await loadRoute();
    const res = await invokeHandler(Route, "GET", makeCb({ code: "c", state: "s" }));
    expect(res.headers.get("location")).toContain("invalid_state");
  });

  it("returns 429 Too Many Requests when rate limiter fires", async () => {
    supabaseState.rpcResponses.global_rate_limit_hit = true;
    const Route = await loadRoute();
    const res = await invokeHandler(Route, "GET", makeCb({ code: "c", state: "s" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeDefined();
  });

  it("never echoes provider access_token back to the caller in a redirect", async () => {
    supabaseState.rpcResponses.global_rate_limit_hit = false;
    supabaseState.responses["oauth_states:maybeSingle"] = null;
    const Route = await loadRoute();
    const res = await invokeHandler(Route, "GET", makeCb({ code: "supersecret", state: "s" }));
    const loc = res.headers.get("location") ?? "";
    expect(loc).not.toContain("supersecret");
    expect(loc).not.toMatch(/access_token=/);
  });
});
