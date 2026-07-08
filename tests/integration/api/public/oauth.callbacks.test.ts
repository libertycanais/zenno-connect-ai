import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invokeHandler } from "@tests/helpers/route";
import { makeRequest } from "@tests/helpers/http";
import { installFetchMock, type FetchMock } from "@tests/mocks/fetch";
import {
  resetSupabaseState,
  supabaseAdminMock,
  supabaseState,
} from "@tests/mocks/supabase-admin";
import { withOrganization } from "@tests/helpers/tenant";

vi.mock("@/integrations/supabase/client.server", async () => {
  const mod = await import("@tests/mocks/supabase-admin");
  return { supabaseAdmin: mod.supabaseAdminMock };
});

async function loadMeta() {
  return (await import("@/routes/api/public/meta.oauth.callback")).Route;
}
async function loadGoogle() {
  return (await import("@/routes/api/public/google-ads.oauth.callback")).Route;
}

function makeCallbackReq(base: string, params: Record<string, string>) {
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return makeRequest(url.toString(), { headers: { "cf-connecting-ip": "1.2.3.4" } });
}

describe("Meta OAuth callback — /api/public/meta/oauth/callback", () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    resetSupabaseState();
    supabaseAdminMock.from.mockClear();
    supabaseAdminMock.rpc.mockClear();
    fetchMock = installFetchMock();
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("redirects to error when both code and state are missing", async () => {
    const Route = await loadMeta();
    const res = await invokeHandler(
      Route,
      "GET",
      makeCallbackReq("http://x/api/public/meta/oauth/callback", {}),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("missing_params");
  });

  it("propagates provider error param", async () => {
    const Route = await loadMeta();
    const res = await invokeHandler(
      Route,
      "GET",
      makeCallbackReq("http://x/api/public/meta/oauth/callback", {
        error: "access_denied",
      }),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("access_denied");
  });

  it("returns 429 when IP rate limit hits", async () => {
    supabaseState.rpcResponses.global_rate_limit_hit = true;
    const Route = await loadMeta();
    const res = await invokeHandler(
      Route,
      "GET",
      makeCallbackReq("http://x/api/public/meta/oauth/callback", {
        code: "c",
        state: "s",
      }),
    );
    expect(res.status).toBe(429);
  });

  it("redirects invalid_state when state row is missing / wrong provider / consumed / expired", async () => {
    supabaseState.rpcResponses.global_rate_limit_hit = false;
    // missing
    supabaseState.responses["oauth_states:maybeSingle"] = null;
    const Route = await loadMeta();
    const res = await invokeHandler(
      Route,
      "GET",
      makeCallbackReq("http://x/api/public/meta/oauth/callback", {
        code: "c",
        state: "unknown",
      }),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("invalid_state");

    // wrong provider
    supabaseState.responses["oauth_states:maybeSingle"] = {
      organization_id: "o1",
      user_id: "u1",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      consumed_at: null,
      provider: "google_ads",
    };
    const res2 = await invokeHandler(
      Route,
      "GET",
      makeCallbackReq("http://x/api/public/meta/oauth/callback", {
        code: "c",
        state: "s",
      }),
    );
    expect(res2.headers.get("location")).toContain("invalid_state");

    // expired
    supabaseState.responses["oauth_states:maybeSingle"] = {
      organization_id: "o1",
      user_id: "u1",
      expires_at: new Date(Date.now() - 1000).toISOString(),
      consumed_at: null,
      provider: "meta",
    };
    const res3 = await invokeHandler(
      Route,
      "GET",
      makeCallbackReq("http://x/api/public/meta/oauth/callback", {
        code: "c",
        state: "s",
      }),
    );
    expect(res3.headers.get("location")).toContain("invalid_state");

    // consumed
    supabaseState.responses["oauth_states:maybeSingle"] = {
      organization_id: "o1",
      user_id: "u1",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      consumed_at: new Date().toISOString(),
      provider: "meta",
    };
    const res4 = await invokeHandler(
      Route,
      "GET",
      makeCallbackReq("http://x/api/public/meta/oauth/callback", {
        code: "c",
        state: "s",
      }),
    );
    expect(res4.headers.get("location")).toContain("invalid_state");
  });

  it("redirects app_not_configured when META_APP_ID / META_APP_SECRET missing", async () => {
    supabaseState.rpcResponses.global_rate_limit_hit = false;
    await withOrganization(async ({ organization, owner }) => {
      supabaseState.responses["oauth_states:maybeSingle"] = {
        organization_id: organization.id,
        user_id: owner.id,
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        consumed_at: null,
        provider: "meta",
      };
      vi.stubEnv("META_APP_ID", "");
      vi.stubEnv("META_APP_SECRET", "");
      const Route = await loadMeta();
      const res = await invokeHandler(
        Route,
        "GET",
        makeCallbackReq("http://x/api/public/meta/oauth/callback", {
          code: "c",
          state: "s",
        }),
      );
      expect(res.headers.get("location")).toContain("app_not_configured");
    });
  });

  it("completes happy-path when token exchange + ad accounts resolve", async () => {
    supabaseState.rpcResponses.global_rate_limit_hit = false;
    await withOrganization(async ({ organization, owner }) => {
      supabaseState.responses["oauth_states:maybeSingle"] = {
        organization_id: organization.id,
        user_id: owner.id,
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        consumed_at: null,
        provider: "meta",
      };
      vi.stubEnv("META_APP_ID", "app");
      vi.stubEnv("META_APP_SECRET", "sec");

      fetchMock.mockResponse(/oauth\/access_token/, {
        access_token: "TKN",
        expires_in: 60,
      });
      fetchMock.mockResponse(/\/me\/adaccounts/, {
        data: [{ account_id: "act_1", name: "One" }],
      });
      fetchMock.mockResponse(/\/me\/businesses/, { data: [] });

      const Route = await loadMeta();
      const res = await invokeHandler(
        Route,
        "GET",
        makeCallbackReq("http://x/api/public/meta/oauth/callback", {
          code: "c",
          state: "s",
        }),
      );
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toContain("connected=");
    });
  });
});

describe("Google Ads OAuth callback — /api/public/google-ads/oauth/callback", () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    resetSupabaseState();
    supabaseAdminMock.from.mockClear();
    supabaseAdminMock.rpc.mockClear();
    fetchMock = installFetchMock();
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("redirects missing_params without code+state", async () => {
    const Route = await loadGoogle();
    const res = await invokeHandler(
      Route,
      "GET",
      makeCallbackReq("http://x/api/public/google-ads/oauth/callback", {}),
    );
    expect(res.headers.get("location")).toContain("missing_params");
  });

  it("returns 429 on rate limit", async () => {
    supabaseState.rpcResponses.global_rate_limit_hit = true;
    const Route = await loadGoogle();
    const res = await invokeHandler(
      Route,
      "GET",
      makeCallbackReq("http://x/api/public/google-ads/oauth/callback", {
        code: "c",
        state: "s",
      }),
    );
    expect(res.status).toBe(429);
  });

  it("redirects invalid_state when state row is missing", async () => {
    supabaseState.rpcResponses.global_rate_limit_hit = false;
    supabaseState.responses["oauth_states:maybeSingle"] = null;
    const Route = await loadGoogle();
    const res = await invokeHandler(
      Route,
      "GET",
      makeCallbackReq("http://x/api/public/google-ads/oauth/callback", {
        code: "c",
        state: "s",
      }),
    );
    expect(res.headers.get("location")).toContain("invalid_state");
  });

  it("redirects app_not_configured when Google env is missing", async () => {
    supabaseState.rpcResponses.global_rate_limit_hit = false;
    await withOrganization(async ({ organization, owner }) => {
      supabaseState.responses["oauth_states:maybeSingle"] = {
        organization_id: organization.id,
        user_id: owner.id,
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        consumed_at: null,
        provider: "google_ads",
      };
      vi.stubEnv("GOOGLE_ADS_CLIENT_ID", "");
      vi.stubEnv("GOOGLE_ADS_CLIENT_SECRET", "");
      const Route = await loadGoogle();
      const res = await invokeHandler(
        Route,
        "GET",
        makeCallbackReq("http://x/api/public/google-ads/oauth/callback", {
          code: "c",
          state: "s",
        }),
      );
      expect(res.headers.get("location")).toContain("app_not_configured");
    });
  });
});
