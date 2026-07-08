/**
 * WS-6 — SECURITY DEFINER surface.
 * Como os testes não podem executar SQL real, cobrimos as RPCs invocadas
 * pelo código de aplicação, garantindo que:
 *   - todas as chamadas passam pelo supabaseAdmin (server-only);
 *   - nomes de RPC continuam estáveis (contrato com o banco).
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

async function loadTracking() {
  return (await import("@/routes/api/public/track.event")).Route;
}

describe("SECURITY DEFINER RPC contract — WS-6", () => {
  beforeEach(() => {
    resetSupabaseState();
    supabaseAdminMock.from.mockClear();
    supabaseAdminMock.rpc.mockClear();
  });
  afterEach(() => vi.clearAllMocks());

  it("tracking route ONLY calls known SECURITY DEFINER RPCs", async () => {
    await withOrganization(async ({ organization }) => {
      supabaseState.responses["organizations:maybeSingle"] = {
        id: organization.id, tracking_allowed_origins: ["only.example.com"],
      };
      const Route = await loadTracking();
      // trigger origin_not_allowed → audit rpc
      await invokeHandler(Route, "POST",
        makeJsonRequest("http://api/api/public/track/event", {
          pk: "pk_valid_1234567", session_id: "sess_sd_1", event_name: "pageview",
        }, { headers: { origin: "https://x.example.com" } }));

      const allowed = new Set([
        "track_compound_rate_limit_hit",
        "app_write_audit_log",
        "global_rate_limit_hit",
      ]);
      const rpcs = supabaseState.captured
        .filter((c) => c.op === "rpc")
        .map((c) => (c.args as { name: string }).name);
      for (const name of rpcs) expect(allowed.has(name)).toBe(true);
    });
  });

  it("audit RPC is called with a non-null actor_org_id (never global)", async () => {
    await withOrganization(async ({ organization }) => {
      supabaseState.responses["organizations:maybeSingle"] = {
        id: organization.id, tracking_allowed_origins: ["only.example.com"],
      };
      const Route = await loadTracking();
      await invokeHandler(Route, "POST",
        makeJsonRequest("http://api/api/public/track/event", {
          pk: "pk_valid_1234567", session_id: "sess_sd_2", event_name: "pageview",
        }, { headers: { origin: "https://evil.com" } }));

      const audit = supabaseState.captured.find(
        (c) => c.op === "rpc" && (c.args as { name: string }).name === "app_write_audit_log",
      );
      const args = (audit!.args as { args: Record<string, unknown> }).args;
      expect(args._actor_org_id).toBe(organization.id);
      expect(args._actor_user_id ?? null).toBeNull();
    });
  });
});
