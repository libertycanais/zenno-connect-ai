/**
 * WS-6 — Tracking dispatch (Meta CAPI + Google Offline Conversion).
 * Foco: PII hashing (SHA-256), idempotência via event_id, tenant scoping,
 * e nunca vazar access_token de volta ao chamador público.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invokeHandler } from "@tests/helpers/route";
import { makeJsonRequest } from "@tests/helpers/http";
import {
  resetSupabaseState,
  supabaseAdminMock,
  supabaseState,
  lastInsert,
} from "@tests/mocks/supabase-admin";
import { installFetchMock } from "@tests/mocks/fetch";
import { withOrganization } from "@tests/helpers/tenant";
import { createHash } from "crypto";

vi.mock("@/integrations/supabase/client.server", async () => {
  const mod = await import("@tests/mocks/supabase-admin");
  return { supabaseAdmin: mod.supabaseAdminMock };
});

async function loadRoute() {
  return (await import("@/routes/api/public/track.event")).Route;
}

const sha = (v: string) =>
  createHash("sha256").update(v.trim().toLowerCase()).digest("hex");

describe("Tracking dispatch — CAPI / Google offline (WS-6)", () => {
  beforeEach(() => {
    resetSupabaseState();
    supabaseAdminMock.from.mockClear();
    supabaseAdminMock.rpc.mockClear();
    installFetchMock();
    supabaseState.rpcResponses.track_compound_rate_limit_hit = false;
  });
  afterEach(() => vi.clearAllMocks());

  it("hashes email (SHA-256 lowercased) before sending to Meta CAPI", async () => {
    await withOrganization(async ({ organization }) => {
      supabaseState.responses["organizations:maybeSingle"] = {
        id: organization.id, tracking_allowed_origins: ["*.example.com"],
      };
      // First maybeSingle call = organizations; second = meta_ad_accounts
      // Our supabase mock keys by table, so both use their own table.
      supabaseState.responses["meta_ad_accounts:maybeSingle"] = {
        id: "acc-1", access_token: "SECRET_TOKEN", pixel_id: "PIX1",
      };
      supabaseState.responses["tracking_leads:maybeSingle"] = null;

      const fm = installFetchMock();
      let capturedBody: string | null = null;
      fm.mockResponder(/graph\.facebook\.com/, async (req) => {
        capturedBody = await req.text();
        return new Response(JSON.stringify({ events_received: 1 }), { status: 200 });
      });

      const Route = await loadRoute();
      const res = await invokeHandler(
        Route,
        "POST",
        makeJsonRequest("http://api/api/public/track/event", {
          pk: "pk_valid_1234567",
          session_id: "sess_capi_1",
          event_name: "Lead",
          email: "USER@Example.COM",
        }, { headers: { origin: "https://shop.example.com" } }),
      );
      expect(res.status).toBe(200);
      expect(capturedBody).toBeTruthy();
      const parsed = JSON.parse(capturedBody!);
      const userData = parsed.data[0].user_data;
      // must be hashed, never raw
      expect(userData.em).toBe(sha("user@example.com"));
      expect(capturedBody).not.toContain("USER@Example.COM");
      expect(capturedBody).not.toContain("user@example.com");
    });
  });

  it("scopes meta_ad_accounts lookup by tenant organization_id", async () => {
    await withOrganization(async ({ organization }) => {
      supabaseState.responses["organizations:maybeSingle"] = {
        id: organization.id, tracking_allowed_origins: ["*.example.com"],
      };
      supabaseState.responses["meta_ad_accounts:maybeSingle"] = null;
      supabaseState.responses["tracking_leads:maybeSingle"] = null;

      const Route = await loadRoute();
      await invokeHandler(
        Route,
        "POST",
        makeJsonRequest("http://api/api/public/track/event", {
          pk: "pk_valid_1234567", session_id: "sess_disp_1", event_name: "Lead",
          fbclid: "fb.abc",
        }, { headers: { origin: "https://shop.example.com" } }),
      );

      const accLookup = supabaseState.captured.find(
        (c) => c.op === "maybeSingle" && c.table === "meta_ad_accounts",
      );
      expect(accLookup).toBeTruthy();
      const filters = (accLookup!.args as { filters: Record<string, unknown> }).filters;
      expect(filters.organization_id).toBe(organization.id);
    });
  });

  it("does not dispatch attribution for non-lead/purchase events", async () => {
    await withOrganization(async ({ organization }) => {
      supabaseState.responses["organizations:maybeSingle"] = {
        id: organization.id, tracking_allowed_origins: ["*.example.com"],
      };
      supabaseState.responses["tracking_leads:maybeSingle"] = null;
      const fm = installFetchMock();
      let called = 0;
      fm.mockResponder(/graph\.facebook\.com/, async () => {
        called += 1;
        return new Response("{}", { status: 200 });
      });
      const Route = await loadRoute();
      await invokeHandler(
        Route,
        "POST",
        makeJsonRequest("http://api/api/public/track/event", {
          pk: "pk_valid_1234567", session_id: "sess_no_lead", event_name: "pageview",
          email: "x@y.z",
        }, { headers: { origin: "https://shop.example.com" } }),
      );
      expect(called).toBe(0);
    });
  });

  it("records google_ads_conversions when gclid is present on Lead", async () => {
    await withOrganization(async ({ organization }) => {
      supabaseState.responses["organizations:maybeSingle"] = {
        id: organization.id, tracking_allowed_origins: ["*.example.com"],
      };
      supabaseState.responses["google_ad_accounts:maybeSingle"] = { id: "gacc-1" };
      supabaseState.responses["tracking_leads:maybeSingle"] = null;
      const Route = await loadRoute();
      const res = await invokeHandler(
        Route,
        "POST",
        makeJsonRequest("http://api/api/public/track/event", {
          pk: "pk_valid_1234567", session_id: "sess_g_1", event_name: "Lead",
          gclid: "Cj0KABC",
        }, { headers: { origin: "https://shop.example.com" } }),
      );
      expect(res.status).toBe(200);
      const conv = lastInsert("google_ads_conversions") as { gclid: string; organization_id: string };
      expect(conv.gclid).toBe("Cj0KABC");
      expect(conv.organization_id).toBe(organization.id);
    });
  });

  it("public 200 response body never contains provider secrets", async () => {
    await withOrganization(async ({ organization }) => {
      supabaseState.responses["organizations:maybeSingle"] = {
        id: organization.id, tracking_allowed_origins: ["*.example.com"],
      };
      supabaseState.responses["meta_ad_accounts:maybeSingle"] = {
        id: "acc-1", access_token: "SUPER_SECRET_TOKEN_XYZ", pixel_id: "PIX1",
      };
      supabaseState.responses["tracking_leads:maybeSingle"] = null;
      const fm = installFetchMock();
      fm.mockResponder(/graph\.facebook\.com/, async () =>
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
      const Route = await loadRoute();
      const res = await invokeHandler(
        Route,
        "POST",
        makeJsonRequest("http://api/api/public/track/event", {
          pk: "pk_valid_1234567", session_id: "sess_secret_1", event_name: "Lead",
          email: "x@y.z",
        }, { headers: { origin: "https://shop.example.com" } }),
      );
      const body = await res.text();
      expect(body).not.toContain("SUPER_SECRET_TOKEN_XYZ");
      expect(body).toBe(JSON.stringify({ ok: true }));
    });
  });
});
