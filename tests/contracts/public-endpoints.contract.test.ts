/**
 * WS-8 — Public Contract Snapshots
 *
 * Congela a superfície de resposta dos endpoints /api/public/* que são
 * consumidos por clientes externos (SDKs, integrações, orquestradores de
 * infraestrutura). Qualquer mudança de campo público quebra este teste
 * intencionalmente — trocas de contrato exigem revisão explícita.
 *
 * Estratégia: extraímos apenas o CONJUNTO DE CHAVES (schema shape) e os
 * valores estáveis. Valores voláteis (timestamp, uptime, versão) são
 * normalizados antes do snapshot para evitar flakiness.
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

vi.mock("@/integrations/supabase/client.server", async () => {
  const mod = await import("@tests/mocks/supabase-admin");
  return { supabaseAdmin: mod.supabaseAdminMock };
});

function normalize(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (Array.isArray(v)) return v.map(normalize);
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (k === "timestamp") out[k] = "<ISO>";
      else if (k === "uptime_seconds") out[k] = "<number>";
      else if (k === "version") out[k] = "<string>";
      else if (k === "latency_ms") out[k] = "<number>";
      else out[k] = normalize(val);
    }
    return out;
  }
  return v;
}

function shapeOf(v: unknown): unknown {
  if (v === null) return "null";
  if (Array.isArray(v)) return v.length === 0 ? [] : [shapeOf(v[0])];
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) {
      out[k] = shapeOf((v as Record<string, unknown>)[k]);
    }
    return out;
  }
  return typeof v;
}

describe("Contract: GET /api/public/live", () => {
  it("response shape is frozen", async () => {
    const { Route } = await import("@/routes/api/public/live");
    const res = await invokeHandler(Route, "GET", makeRequest("http://x/api/public/live"));
    expect(res.status).toBe(200);
    const body = normalize(await res.json());
    expect(body).toMatchInlineSnapshot(`
      {
        "status": "ok",
        "timestamp": "<ISO>",
      }
    `);
  });
});

describe("Contract: GET /api/public/health", () => {
  it("response shape is frozen", async () => {
    const { Route } = await import("@/routes/api/public/health");
    const res = await invokeHandler(Route, "GET", makeRequest("http://x/api/public/health"));
    expect(res.status).toBe(200);
    const raw = (await res.json()) as Record<string, unknown>;
    // shape only — values differ by environment
    expect(shapeOf(raw)).toMatchInlineSnapshot(`
      {
        "environment": "string",
        "service": "string",
        "status": "string",
        "timestamp": "string",
        "uptime_seconds": "number",
        "version": "string",
      }
    `);
    expect(raw.status).toBe("ok");
  });
});

describe("Contract: GET /api/public/ready", () => {
  it("response shape is frozen (checks.postgres, checks.redis)", async () => {
    const { Route } = await import("@/routes/api/public/ready");
    const res = await invokeHandler(Route, "GET", makeRequest("http://x/api/public/ready"));
    const raw = (await res.json()) as Record<string, unknown>;
    const shape = shapeOf(raw);
    expect(shape).toMatchObject({
      status: "string",
      timestamp: "string",
      checks: {
        postgres: { status: "string" },
        redis: { status: "string" },
      },
    });
    // status must be one of the frozen values
    expect(["ready", "not_ready"]).toContain(raw.status);
  });
});

describe("Contract: POST /api/public/track/event", () => {
  beforeEach(() => {
    resetSupabaseState();
    supabaseAdminMock.from.mockClear();
    supabaseAdminMock.rpc.mockClear();
  });
  afterEach(() => vi.clearAllMocks());

  it("success response is { ok: true } (no fields leak)", async () => {
    await withOrganization(async ({ organization }) => {
      supabaseState.responses["organizations:maybeSingle"] = {
        id: organization.id,
        tracking_allowed_origins: ["*.example.com"],
      };
      supabaseState.responses["tracking_leads:maybeSingle"] = null;
      supabaseState.rpcResponses.track_compound_rate_limit_hit = false;
      const { Route } = await import("@/routes/api/public/track.event");
      const req = makeJsonRequest(
        "http://x/api/public/track/event",
        { pk: "pk_test_valid_123456", session_id: "sess_abcdefgh_1234", event_name: "pageview" },
        { headers: { origin: "https://shop.example.com" } },
      );
      const res = await invokeHandler(Route, "POST", req);
      expect(await res.json()).toEqual({ ok: true });
    });
  });

  it("error responses use { ok?: false, error: <code> } — codes are frozen", async () => {
    const { Route } = await import("@/routes/api/public/track.event");
    const req = new Request("http://x/api/public/track/event", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://shop.example.com" },
      body: "not json",
    });
    const res = await invokeHandler(Route, "POST", req);
    expect(await res.json()).toEqual({ ok: false, error: "invalid_json" });
  });
});

describe("Contract: POST /api/public/track/wa-link", () => {
  beforeEach(() => {
    resetSupabaseState();
    supabaseAdminMock.from.mockClear();
    supabaseAdminMock.rpc.mockClear();
  });

  it("error contract shape is frozen", async () => {
    const { Route } = await import("@/routes/api/public/track.wa-link");
    const req = makeJsonRequest(
      "http://x/api/public/track/wa-link",
      { pk: "short" },
      { headers: { origin: "https://shop.example.com" } },
    );
    const res = await invokeHandler(Route, "POST", req);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ error: expect.any(String) });
  });
});

describe("Contract: OAuth callbacks redirect to app routes", () => {
  it("meta callback with missing params redirects (no JSON body leak)", async () => {
    const { Route } = await import("@/routes/api/public/meta.oauth.callback");
    const res = await invokeHandler(
      Route,
      "GET",
      makeRequest("http://x/api/public/meta/oauth/callback"),
    );
    // Redirect response — status 3xx, no body of PII/tokens
    expect([301, 302, 303, 307, 308]).toContain(res.status);
    const loc = res.headers.get("location") ?? "";
    expect(loc.startsWith("/app/meta-ads")).toBe(true);
    expect(loc).not.toMatch(/access_token|refresh_token|client_secret/i);
  });

  it("google callback with missing params redirects (no JSON body leak)", async () => {
    const { Route } = await import("@/routes/api/public/google-ads.oauth.callback");
    const res = await invokeHandler(
      Route,
      "GET",
      makeRequest("http://x/api/public/google-ads/oauth/callback"),
    );
    expect([301, 302, 303, 307, 308]).toContain(res.status);
    const loc = res.headers.get("location") ?? "";
    expect(loc).not.toMatch(/access_token|refresh_token|client_secret/i);
  });
});

describe("Contract: POST /api/public/whatsapp/webhook/:instanceId", () => {
  beforeEach(() => resetSupabaseState());

  it("unauthorized shape is plain text 401 (no JSON leak)", async () => {
    const { Route } = await import("@/routes/api/public/whatsapp.webhook.$instanceId");
    const req = makeJsonRequest("http://x/api/public/whatsapp/webhook/inst-1", {});
    const res = await invokeHandler(Route, "POST", req, { instanceId: "inst-1" });
    expect(res.status).toBe(401);
    // Contract: no body containing tokens/secrets
    const text = await res.text();
    expect(text).not.toMatch(/access_token|webhook_secret|password/i);
  });
});
