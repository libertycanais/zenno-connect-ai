import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invokeHandler } from "@tests/helpers/route";
import { makeJsonRequest, makeRequest } from "@tests/helpers/http";
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

// Load route AFTER vi.mock (dynamic to guarantee mock is applied).
async function loadRoute() {
  return (await import("@/routes/api/public/track.event")).Route;
}

const validPk = "pk_test_valid_123456";
const sessionId = "sess_abcdefgh_1234";

function makeEventReq(
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  return makeJsonRequest("http://api.example.com/api/public/track/event", body, {
    headers: { origin: "https://shop.example.com", ...headers },
  });
}

describe("POST /api/public/track/event", () => {
  beforeEach(() => {
    resetSupabaseState();
    supabaseAdminMock.from.mockClear();
    supabaseAdminMock.rpc.mockClear();
  });
  afterEach(() => vi.clearAllMocks());

  it("OPTIONS preflight returns 204 with CORS + Vary: Origin echoing request origin", async () => {
    const Route = await loadRoute();
    const req = makeRequest("http://api.example.com/api/public/track/event", {
      method: "OPTIONS",
      headers: { origin: "https://shop.example.com" },
    });
    const res = await invokeHandler(Route, "OPTIONS", req);
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://shop.example.com");
    expect(res.headers.get("vary")).toBe("Origin");
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
  });

  it("returns 400 invalid_json on non-JSON body", async () => {
    const Route = await loadRoute();
    const req = new Request("http://api.example.com/api/public/track/event", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://shop.example.com" },
      body: "not json",
    });
    const res = await invokeHandler(Route, "POST", req);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "invalid_json" });
    expect(res.headers.get("vary")).toBe("Origin");
  });

  it("returns 400 invalid_payload on schema mismatch", async () => {
    const Route = await loadRoute();
    const res = await invokeHandler(
      Route,
      "POST",
      makeEventReq({ pk: "short", event_name: "" }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_payload" });
  });

  it("returns 400 invalid_pk when org lookup misses", async () => {
    supabaseState.responses["organizations:maybeSingle"] = null;
    const Route = await loadRoute();
    const res = await invokeHandler(
      Route,
      "POST",
      makeEventReq({ pk: validPk, session_id: sessionId, event_name: "pageview" }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_pk" });
  });

  it("returns 403 origin_not_allowed when Origin+Referer host is off the allowlist (audits)", async () => {
    await withOrganization(async ({ organization }) => {
      supabaseState.responses["organizations:maybeSingle"] = {
        id: organization.id,
        tracking_allowed_origins: ["different.com"],
      };
      const Route = await loadRoute();
      const res = await invokeHandler(
        Route,
        "POST",
        makeEventReq({ pk: validPk, session_id: sessionId, event_name: "pageview" }),
      );
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ error: "origin_not_allowed" });
      // audit RPC called
      const rpcCalls = supabaseState.captured.filter((c) => c.op === "rpc");
      expect(rpcCalls.some((c) => (c.args as { name: string }).name === "app_write_audit_log")).toBe(
        true,
      );
    });
  });

  it("returns 403 origin_not_allowed when allowlist is empty (multi-tenant enforcement)", async () => {
    await withOrganization(async ({ organization }) => {
      supabaseState.responses["organizations:maybeSingle"] = {
        id: organization.id,
        tracking_allowed_origins: [],
      };
      const Route = await loadRoute();
      const res = await invokeHandler(
        Route,
        "POST",
        makeEventReq({ pk: validPk, session_id: sessionId, event_name: "pageview" }),
      );
      expect(res.status).toBe(403);
    });
  });

  it("returns 403 for server-to-server request without Origin/Referer even if allowlist is valid", async () => {
    await withOrganization(async ({ organization }) => {
      supabaseState.responses["organizations:maybeSingle"] = {
        id: organization.id,
        tracking_allowed_origins: ["shop.example.com"],
      };
      const Route = await loadRoute();
      const req = makeJsonRequest("http://api.example.com/api/public/track/event", {
        pk: validPk,
        session_id: sessionId,
        event_name: "pageview",
      });
      const res = await invokeHandler(Route, "POST", req);
      expect(res.status).toBe(403);
    });
  });

  it("accepts wildcard subdomain and inserts tracking_events + tracking_leads", async () => {
    await withOrganization(async ({ organization }) => {
      supabaseState.responses["organizations:maybeSingle"] = {
        id: organization.id,
        tracking_allowed_origins: ["*.example.com"],
      };
      supabaseState.responses["tracking_leads:maybeSingle"] = null;
      supabaseState.rpcResponses.track_compound_rate_limit_hit = false;

      const Route = await loadRoute();
      const res = await invokeHandler(
        Route,
        "POST",
        makeEventReq({
          pk: validPk,
          session_id: sessionId,
          event_name: "pageview",
          utm_source: "meta",
        }),
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      const tables = supabaseState.captured
        .filter((c) => c.op === "insert")
        .map((c) => c.table);
      expect(tables).toContain("tracking_events");
      expect(tables).toContain("tracking_leads");
    });
  });

  it("returns 429 rate_limited on IP compound limiter hit", async () => {
    await withOrganization(async ({ organization }) => {
      supabaseState.responses["organizations:maybeSingle"] = {
        id: organization.id,
        tracking_allowed_origins: ["shop.example.com"],
      };
      supabaseState.rpcResponses.track_compound_rate_limit_hit = true;
      const Route = await loadRoute();
      const res = await invokeHandler(
        Route,
        "POST",
        makeEventReq({ pk: validPk, session_id: sessionId, event_name: "pageview" }),
      );
      expect(res.status).toBe(429);
      expect(await res.json()).toMatchObject({ error: "rate_limited" });
      // audit called
      expect(
        supabaseState.captured.some(
          (c) => c.op === "rpc" && (c.args as { name: string }).name === "app_write_audit_log",
        ),
      ).toBe(true);
    });
  });

  it("always includes Vary: Origin on success (CORS correctness)", async () => {
    await withOrganization(async ({ organization }) => {
      supabaseState.responses["organizations:maybeSingle"] = {
        id: organization.id,
        tracking_allowed_origins: ["*.example.com"],
      };
      supabaseState.rpcResponses.track_compound_rate_limit_hit = false;
      const Route = await loadRoute();
      const res = await invokeHandler(
        Route,
        "POST",
        makeEventReq({ pk: validPk, session_id: sessionId, event_name: "pageview" }),
      );
      expect(res.headers.get("vary")).toBe("Origin");
      expect(res.headers.get("access-control-allow-origin")).toBe("https://shop.example.com");
    });
  });
});
