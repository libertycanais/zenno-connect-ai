import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invokeHandler } from "@tests/helpers/route";
import { makeJsonRequest } from "@tests/helpers/http";
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

async function loadRoute() {
  return (await import("@/routes/api/public/track.wa-link")).Route;
}

const validPk = "pk_test_valid_123456";
const sessionId = "sess_abcdefgh_1234";

function req(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return makeJsonRequest("http://api.example.com/api/public/track/wa-link", body, {
    headers: { origin: "https://shop.example.com", ...headers },
  });
}

describe("POST /api/public/track/wa-link", () => {
  beforeEach(() => {
    resetSupabaseState();
    supabaseAdminMock.from.mockClear();
    supabaseAdminMock.rpc.mockClear();
  });
  afterEach(() => vi.clearAllMocks());

  it("returns 400 invalid_json on non-JSON body", async () => {
    const Route = await loadRoute();
    const r = new Request("http://api.example.com/api/public/track/wa-link", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://shop.example.com" },
      body: "{oops",
    });
    const res = await invokeHandler(Route, "POST", r);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_json" });
  });

  it("returns 400 invalid_payload on missing fields", async () => {
    const Route = await loadRoute();
    const res = await invokeHandler(Route, "POST", req({ pk: validPk }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_payload" });
  });

  it("returns 400 invalid_pk when org lookup misses", async () => {
    supabaseState.responses["organizations:maybeSingle"] = null;
    const Route = await loadRoute();
    const res = await invokeHandler(
      Route,
      "POST",
      req({ pk: validPk, phone: "5511999999999", session_id: sessionId }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_pk" });
  });

  it("returns 403 origin_not_allowed when allowlist empty", async () => {
    await withOrganization(async ({ organization }) => {
      supabaseState.responses["organizations:maybeSingle"] = {
        id: organization.id,
        tracking_allowed_origins: [],
      };
      const Route = await loadRoute();
      const res = await invokeHandler(
        Route,
        "POST",
        req({ pk: validPk, phone: "5511999999999", session_id: sessionId }),
      );
      expect(res.status).toBe(403);
    });
  });

  it("returns 429 when rate limit RPC returns true", async () => {
    await withOrganization(async ({ organization }) => {
      supabaseState.responses["organizations:maybeSingle"] = {
        id: organization.id,
        tracking_allowed_origins: ["shop.example.com"],
      };
      supabaseState.rpcResponses.track_rate_limit_hit = true;
      const Route = await loadRoute();
      const res = await invokeHandler(
        Route,
        "POST",
        req({ pk: validPk, phone: "5511999999999", session_id: sessionId }),
      );
      expect(res.status).toBe(429);
    });
  });

  it("returns 200 with wa.me URL + tracking code on happy path", async () => {
    await withOrganization(async ({ organization }) => {
      supabaseState.responses["organizations:maybeSingle"] = {
        id: organization.id,
        tracking_allowed_origins: ["*.example.com"],
      };
      supabaseState.rpcResponses.track_rate_limit_hit = false;
      const Route = await loadRoute();
      const res = await invokeHandler(
        Route,
        "POST",
        req({
          pk: validPk,
          phone: "+55 (11) 99999-9999",
          session_id: sessionId,
          message: "Olá",
        }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: true; url: string; code: string };
      expect(body.url).toMatch(/^https:\/\/wa\.me\/5511999999999\?text=/);
      expect(body.code).toMatch(/^[A-Z2-9]{6}$/);
    });
  });
});
