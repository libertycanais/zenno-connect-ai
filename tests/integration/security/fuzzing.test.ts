/**
 * WS-6 — Fuzzing / adversarial input.
 * Verifica que payloads maliciosos comuns (JSON bomb, SQL-injection-ish,
 * unicode/null bytes, headers escapados, strings absurdamente longas)
 * são rejeitados com 400 e não crasham o handler.
 */
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
  return (await import("@/routes/api/public/track.event")).Route;
}

const BASE_HEADERS = { origin: "https://shop.example.com" };

async function post(body: unknown) {
  const Route = await loadRoute();
  return invokeHandler(
    Route, "POST",
    makeJsonRequest("http://api/api/public/track/event", body, { headers: BASE_HEADERS }),
  );
}

describe("Fuzzing / adversarial — WS-6", () => {
  beforeEach(() => {
    resetSupabaseState();
    supabaseAdminMock.from.mockClear();
    supabaseAdminMock.rpc.mockClear();
    supabaseState.rpcResponses.track_compound_rate_limit_hit = false;
  });
  afterEach(() => vi.clearAllMocks());

  it("rejects an event_name over the 64-char cap", async () => {
    const res = await post({
      pk: "pk_valid_1234567",
      session_id: "sess_fuzz_1",
      event_name: "x".repeat(65),
    });
    expect(res.status).toBe(400);
  });

  it("rejects negative or absurd value", async () => {
    for (const v of [-1, 2_000_000, Number.NaN, Number.POSITIVE_INFINITY]) {
      const res = await post({
        pk: "pk_valid_1234567",
        session_id: "sess_fuzz_v",
        event_name: "purchase",
        value: v,
      });
      expect(res.status).toBe(400);
    }
  });

  it("rejects invalid email format", async () => {
    const res = await post({
      pk: "pk_valid_1234567", session_id: "sess_fuzz_e",
      event_name: "Lead", email: "not-an-email",
    });
    expect(res.status).toBe(400);
  });

  it("rejects a currency that is not 3 letters", async () => {
    const res = await post({
      pk: "pk_valid_1234567", session_id: "sess_fuzz_c",
      event_name: "purchase", currency: "DOLLARS",
    });
    expect(res.status).toBe(400);
  });

  it("rejects pk too short (SQL-injection-ish input in wrong field)", async () => {
    const res = await post({
      pk: "'; DROP TABLE users;--",
      session_id: "sess_fuzz_sql",
      event_name: "pageview",
    });
    // pk is > 8 chars, so goes further; must NOT crash — either 400 or 400 invalid_pk
    expect([400]).toContain(res.status);
  });

  it("does not crash on unicode/null-byte in text fields", async () => {
    await withOrganization(async ({ organization }) => {
      supabaseState.responses["organizations:maybeSingle"] = {
        id: organization.id, tracking_allowed_origins: ["*.example.com"],
      };
      supabaseState.responses["tracking_leads:maybeSingle"] = null;
      const res = await post({
        pk: "pk_valid_1234567", session_id: "sess_fuzz_u",
        event_name: "pageview",
        utm_source: "meta\u0000\u202e\ud83d\ude00",
        page_title: "hello\u0000world",
      });
      expect([200, 400]).toContain(res.status);
    });
  });

  it("returns 400 on an empty JSON body {}", async () => {
    const res = await post({});
    expect(res.status).toBe(400);
  });

  it("returns 400 on totally invalid JSON", async () => {
    const Route = await loadRoute();
    const req = new Request("http://api/api/public/track/event", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://shop.example.com" },
      body: "definitely-not-json",
    });
    const res = await invokeHandler(Route, "POST", req);
    expect(res.status).toBe(400);
  });

  it("tolerates extra hostile fields (passthrough) but persists ONLY known columns", async () => {
    await withOrganization(async ({ organization }) => {
      supabaseState.responses["organizations:maybeSingle"] = {
        id: organization.id, tracking_allowed_origins: ["*.example.com"],
      };
      supabaseState.responses["tracking_leads:maybeSingle"] = null;
      const res = await post({
        pk: "pk_valid_1234567", session_id: "sess_fuzz_ex",
        event_name: "pageview",
        // hostile passthrough fields — must not overwrite organization_id or ip
        organization_id: "attacker",
        ip: "6.6.6.6",
        raw: { evil: true },
      });
      expect(res.status).toBe(200);
      const ins = supabaseState.captured.find(
        (c) => c.op === "insert" && c.table === "tracking_events",
      );
      const row = ins!.args as { organization_id: string; ip: string | null };
      expect(row.organization_id).toBe(organization.id);
      expect(row.ip).not.toBe("6.6.6.6");
    });
  });
});
