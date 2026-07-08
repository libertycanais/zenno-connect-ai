/**
 * WS-6 — Rate limiting invariants.
 * Cobre tracking (compound IP + public-key), OAuth (global) e webhook (global).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invokeHandler } from "@tests/helpers/route";
import { makeJsonRequest, makeRequest } from "@tests/helpers/http";
import {
  resetSupabaseState,
  supabaseAdminMock,
  supabaseState,
} from "@tests/mocks/supabase-admin";
import { withOrganization } from "@tests/helpers/tenant";
import {
  TRACKING_IP_RATE_LIMIT_PER_MINUTE,
  TRACKING_PUBLIC_KEY_RATE_LIMIT_PER_MINUTE,
  trackingRateLimitKeys,
} from "@/lib/tracking-security";

vi.mock("@/integrations/supabase/client.server", async () => {
  const mod = await import("@tests/mocks/supabase-admin");
  return { supabaseAdmin: mod.supabaseAdminMock };
});

async function loadTracking() {
  return (await import("@/routes/api/public/track.event")).Route;
}
async function loadOAuthMeta() {
  return (await import("@/routes/api/public/meta.oauth.callback")).Route;
}
async function loadWebhook() {
  return (await import("@/routes/api/public/whatsapp.webhook.$instanceId")).Route;
}

describe("Rate limit — WS-6", () => {
  beforeEach(() => {
    resetSupabaseState();
    supabaseAdminMock.from.mockClear();
    supabaseAdminMock.rpc.mockClear();
  });
  afterEach(() => vi.clearAllMocks());

  it("tracking rate limit constants are sane (IP < public key)", () => {
    expect(TRACKING_IP_RATE_LIMIT_PER_MINUTE).toBeGreaterThan(0);
    expect(TRACKING_PUBLIC_KEY_RATE_LIMIT_PER_MINUTE).toBeGreaterThan(
      TRACKING_IP_RATE_LIMIT_PER_MINUTE,
    );
  });

  it("tracking key builder produces namespaced compound keys", () => {
    const keys = trackingRateLimitKeys("org-1", "pk_1", "1.2.3.4");
    expect(keys.ipKey).toContain("org-1");
    expect(keys.ipKey).toContain("pk_1");
    expect(keys.ipKey).toContain("1.2.3.4");
    expect(keys.publicKeyKey).toContain("org-1");
    expect(keys.publicKeyKey).toContain("pk_1");
    expect(keys.publicKeyKey).not.toContain("1.2.3.4");
  });

  it("tracking route invokes RPC with configured limits", async () => {
    await withOrganization(async ({ organization }) => {
      supabaseState.responses["organizations:maybeSingle"] = {
        id: organization.id, tracking_allowed_origins: ["*.example.com"],
      };
      supabaseState.rpcResponses.track_compound_rate_limit_hit = false;
      const Route = await loadTracking();
      await invokeHandler(
        Route, "POST",
        makeJsonRequest("http://api/api/public/track/event", {
          pk: "pk_valid_1234567", session_id: "sess_rl_1", event_name: "pageview",
        }, { headers: { origin: "https://shop.example.com" } }),
      );
      const rpcs = supabaseState.captured
        .filter((c) => c.op === "rpc")
        .map((c) => c.args as { name: string; args: Record<string, unknown> })
        .filter((c) => c.name === "track_compound_rate_limit_hit");
      expect(rpcs.length).toBeGreaterThanOrEqual(2);
      const limits = rpcs.map((c) => c.args._max);
      expect(limits).toContain(TRACKING_IP_RATE_LIMIT_PER_MINUTE);
      expect(limits).toContain(TRACKING_PUBLIC_KEY_RATE_LIMIT_PER_MINUTE);
    });
  });

  it("OAuth callback returns 429 with Retry-After header", async () => {
    supabaseState.rpcResponses.global_rate_limit_hit = true;
    const Route = await loadOAuthMeta();
    const url = new URL("http://x/api/public/meta/oauth/callback");
    url.searchParams.set("code", "c");
    url.searchParams.set("state", "s");
    const res = await invokeHandler(Route, "GET",
      makeRequest(url.toString(), { headers: { "cf-connecting-ip": "1.1.1.1" } }));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeDefined();
  });

  it("Webhook returns 429 when instance-scoped limiter fires", async () => {
    supabaseState.rpcResponses.global_rate_limit_hit = true;
    const Route = await loadWebhook();
    const req = new Request("http://api/api/public/whatsapp/webhook/i-1", {
      method: "POST",
      headers: { "content-type": "application/json", "x-webhook-secret": "s" },
      body: "{}",
    });
    const res = await invokeHandler(Route, "POST", req, { instanceId: "i-1" });
    expect(res.status).toBe(429);
  });
});
