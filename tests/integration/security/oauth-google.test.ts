/**
 * WS-6 — OAuth Google Ads callback: state binding + rate limit.
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
  return (await import("@/routes/api/public/google-ads.oauth.callback")).Route;
}

function makeCb(params: Record<string, string>) {
  const url = new URL("http://x/api/public/google-ads/oauth/callback");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return makeRequest(url.toString(), { headers: { "cf-connecting-ip": "5.5.5.5" } });
}

describe("Google Ads OAuth callback — security invariants", () => {
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

  it("rejects a Meta-issued state on the Google callback (provider binding)", async () => {
    supabaseState.rpcResponses.global_rate_limit_hit = false;
    supabaseState.responses["oauth_states:maybeSingle"] = {
      organization_id: "org-1",
      user_id: "user-1",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      consumed_at: null,
      provider: "meta",
    };
    const Route = await loadRoute();
    const res = await invokeHandler(Route, "GET", makeCb({ code: "c", state: "s" }));
    expect(res.headers.get("location")).toContain("invalid_state");
  });

  it("returns 429 on rate limit", async () => {
    supabaseState.rpcResponses.global_rate_limit_hit = true;
    const Route = await loadRoute();
    const res = await invokeHandler(Route, "GET", makeCb({ code: "c", state: "s" }));
    expect(res.status).toBe(429);
  });

  it("propagates provider ?error= without exposing internals", async () => {
    const Route = await loadRoute();
    const res = await invokeHandler(Route, "GET", makeCb({ error: "access_denied" }));
    expect(res.status).toBe(302);
    const loc = res.headers.get("location") ?? "";
    expect(loc).toContain("access_denied");
    expect(loc).not.toContain("stack");
    expect(loc).not.toContain("SUPABASE");
  });

  it("redirects app_not_configured when env is missing (no secret leak)", async () => {
    supabaseState.rpcResponses.global_rate_limit_hit = false;
    supabaseState.responses["oauth_states:maybeSingle"] = {
      organization_id: "org-1", user_id: "user-1",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      consumed_at: null, provider: "google_ads",
    };
    vi.stubEnv("GOOGLE_ADS_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_ADS_CLIENT_SECRET", "");
    const Route = await loadRoute();
    const res = await invokeHandler(Route, "GET", makeCb({ code: "c", state: "s" }));
    const loc = res.headers.get("location") ?? "";
    expect(loc).toContain("app_not_configured");
    expect(loc).not.toContain("CLIENT_SECRET");
  });
});
