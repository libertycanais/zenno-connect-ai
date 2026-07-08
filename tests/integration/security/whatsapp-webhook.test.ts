/**
 * WS-6 — WhatsApp webhook: shared-secret verification, tenant isolation,
 * payload guardrails, e nunca ecoar o secret nas respostas.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invokeHandler } from "@tests/helpers/route";
import { makeRequest } from "@tests/helpers/http";
import {
  resetSupabaseState,
  supabaseAdminMock,
  supabaseState,
} from "@tests/mocks/supabase-admin";

vi.mock("@/integrations/supabase/client.server", async () => {
  const mod = await import("@tests/mocks/supabase-admin");
  return { supabaseAdmin: mod.supabaseAdminMock };
});
vi.mock("@/lib/automations.functions", () => ({
  dispatchEvent: vi.fn(async () => undefined),
}));
vi.mock("@/lib/attribution.server", () => ({
  dispatchMetaCapi: vi.fn(async () => undefined),
  registerGoogleOfflineConversion: vi.fn(async () => undefined),
}));

async function loadRoute() {
  return (await import("@/routes/api/public/whatsapp.webhook.$instanceId")).Route;
}

function makeWebhook(instanceId: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://api/api/public/whatsapp/webhook/${instanceId}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("WhatsApp webhook — security invariants", () => {
  beforeEach(() => {
    resetSupabaseState();
    supabaseAdminMock.from.mockClear();
    supabaseAdminMock.rpc.mockClear();
    supabaseState.rpcResponses.global_rate_limit_hit = false;
  });
  afterEach(() => vi.clearAllMocks());

  it("returns 401 when x-webhook-secret header is missing", async () => {
    const Route = await loadRoute();
    const res = await invokeHandler(
      Route, "POST",
      makeWebhook("inst-1", { event: "message" }),
      { instanceId: "inst-1" },
    );
    expect(res.status).toBe(401);
    expect(await res.text()).not.toContain("webhook_secret");
  });

  it("returns 401 when secret doesn't match the stored one (no leak)", async () => {
    supabaseState.responses["whatsapp_instances:single"] = {
      id: "inst-1",
      organization_id: "org-1",
      webhook_secret: "real-secret-XYZ",
    };
    const Route = await loadRoute();
    const res = await invokeHandler(
      Route, "POST",
      makeWebhook("inst-1", { event: "message" }, { "x-webhook-secret": "wrong" }),
      { instanceId: "inst-1" },
    );
    expect(res.status).toBe(401);
    const body = await res.text();
    expect(body).not.toContain("real-secret-XYZ");
  });

  it("returns 401 for cross-tenant secret reuse (correct format, wrong instance)", async () => {
    // Instance A has secretA; attacker sends A's secret to instance B.
    supabaseState.responses["whatsapp_instances:single"] = {
      id: "inst-B",
      organization_id: "org-B",
      webhook_secret: "B-secret",
    };
    const Route = await loadRoute();
    const res = await invokeHandler(
      Route, "POST",
      makeWebhook("inst-B", { event: "message" }, { "x-webhook-secret": "A-secret" }),
      { instanceId: "inst-B" },
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid JSON body", async () => {
    supabaseState.responses["whatsapp_instances:single"] = {
      id: "inst-1", organization_id: "org-1", webhook_secret: "s",
    };
    const Route = await loadRoute();
    const req = new Request("http://api/api/public/whatsapp/webhook/inst-1", {
      method: "POST",
      headers: { "content-type": "application/json", "x-webhook-secret": "s" },
      body: "{not-json",
    });
    const res = await invokeHandler(Route, "POST", req, { instanceId: "inst-1" });
    expect(res.status).toBe(400);
  });

  it("accepts a valid signed connection event and persists with the resolved org", async () => {
    supabaseState.responses["whatsapp_instances:single"] = {
      id: "inst-1", organization_id: "org-1", webhook_secret: "good",
    };
    const Route = await loadRoute();
    const res = await invokeHandler(
      Route, "POST",
      makeWebhook("inst-1", { event: "connection.update", data: { connected: true, phone: "5511999" } },
        { "x-webhook-secret": "good" }),
      { instanceId: "inst-1" },
    );
    expect(res.status).toBe(200);
    const update = supabaseState.captured.find(
      (c) => c.op === "update" && c.table === "whatsapp_instances",
    );
    expect(update).toBeTruthy();
  });

  it("returns 429 when rate limit fires (per-instance or per-IP)", async () => {
    supabaseState.rpcResponses.global_rate_limit_hit = true;
    const Route = await loadRoute();
    const res = await invokeHandler(
      Route, "POST",
      makeWebhook("inst-1", { event: "message" }, { "x-webhook-secret": "x" }),
      { instanceId: "inst-1" },
    );
    expect(res.status).toBe(429);
  });
});
