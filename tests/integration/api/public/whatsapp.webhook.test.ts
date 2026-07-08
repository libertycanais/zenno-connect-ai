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
// Stub attribution + automations imports pulled dynamically in the handler.
vi.mock("@/lib/attribution.server", () => ({
  dispatchMetaCapi: vi.fn(async () => undefined),
  registerGoogleOfflineConversion: vi.fn(async () => undefined),
}));
vi.mock("@/lib/automations.functions", () => ({
  dispatchEvent: vi.fn(() => Promise.resolve()),
}));

async function loadRoute() {
  return (await import("@/routes/api/public/whatsapp.webhook.$instanceId")).Route;
}

function req(
  body: unknown,
  instanceId: string,
  headers: Record<string, string> = {},
) {
  return makeJsonRequest(
    `http://api.example.com/api/public/whatsapp/webhook/${instanceId}`,
    body,
    { headers: { "cf-connecting-ip": "1.2.3.4", ...headers } },
  );
}

describe("POST /api/public/whatsapp/webhook/$instanceId", () => {
  beforeEach(() => {
    resetSupabaseState();
    supabaseAdminMock.from.mockClear();
    supabaseAdminMock.rpc.mockClear();
  });
  afterEach(() => vi.clearAllMocks());

  it("returns 429 when instance limiter is hit", async () => {
    supabaseState.rpcResponses.global_rate_limit_hit = true;
    const Route = await loadRoute();
    const res = await invokeHandler(
      Route,
      "POST",
      req({}, "inst_1", { "x-webhook-secret": "s" }),
      { instanceId: "inst_1" },
    );
    expect(res.status).toBe(429);
  });

  it("returns 401 when webhook secret header is missing", async () => {
    supabaseState.rpcResponses.global_rate_limit_hit = false;
    const Route = await loadRoute();
    const res = await invokeHandler(
      Route,
      "POST",
      req({}, "inst_1"),
      { instanceId: "inst_1" },
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 when secret mismatches instance record", async () => {
    supabaseState.rpcResponses.global_rate_limit_hit = false;
    await withOrganization(async ({ organization }) => {
      supabaseState.responses["whatsapp_instances:single"] = {
        id: "inst_1",
        organization_id: organization.id,
        webhook_secret: "expected-secret",
      };
      const Route = await loadRoute();
      const res = await invokeHandler(
        Route,
        "POST",
        req({}, "inst_1", { "x-webhook-secret": "WRONG" }),
        { instanceId: "inst_1" },
      );
      expect(res.status).toBe(401);
    });
  });

  it("returns 401 when instance is not found", async () => {
    supabaseState.rpcResponses.global_rate_limit_hit = false;
    supabaseState.responses["whatsapp_instances:single"] = null;
    const Route = await loadRoute();
    const res = await invokeHandler(
      Route,
      "POST",
      req({}, "inst_missing", { "x-webhook-secret": "any" }),
      { instanceId: "inst_missing" },
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid JSON body (still authorized)", async () => {
    supabaseState.rpcResponses.global_rate_limit_hit = false;
    await withOrganization(async ({ organization }) => {
      supabaseState.responses["whatsapp_instances:single"] = {
        id: "inst_1",
        organization_id: organization.id,
        webhook_secret: "s",
      };
      const Route = await loadRoute();
      const r = new Request(
        "http://api.example.com/api/public/whatsapp/webhook/inst_1",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-webhook-secret": "s",
            "cf-connecting-ip": "1.2.3.4",
          },
          body: "not json",
        },
      );
      const res = await invokeHandler(Route, "POST", r, { instanceId: "inst_1" });
      expect(res.status).toBe(400);
    });
  });

  it("connection event updates instance status without processing message tables", async () => {
    supabaseState.rpcResponses.global_rate_limit_hit = false;
    await withOrganization(async ({ organization }) => {
      supabaseState.responses["whatsapp_instances:single"] = {
        id: "inst_1",
        organization_id: organization.id,
        webhook_secret: "s",
      };
      const Route = await loadRoute();
      const res = await invokeHandler(
        Route,
        "POST",
        req(
          { event: "connection", data: { connected: true, phone: "+55" } },
          "inst_1",
          { "x-webhook-secret": "s" },
        ),
        { instanceId: "inst_1" },
      );
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("ok");
      const updates = supabaseState.captured.filter((c) => c.op === "update");
      expect(updates.some((u) => u.table === "whatsapp_instances")).toBe(true);
    });
  });

  it("message event without phone is swallowed with 200 (retry-safe)", async () => {
    supabaseState.rpcResponses.global_rate_limit_hit = false;
    await withOrganization(async ({ organization }) => {
      supabaseState.responses["whatsapp_instances:single"] = {
        id: "inst_1",
        organization_id: organization.id,
        webhook_secret: "s",
      };
      const Route = await loadRoute();
      const res = await invokeHandler(
        Route,
        "POST",
        req({ event: "message", data: { text: "hi" } }, "inst_1", {
          "x-webhook-secret": "s",
        }),
        { instanceId: "inst_1" },
      );
      expect(res.status).toBe(200);
    });
  });
});
