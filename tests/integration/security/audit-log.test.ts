/**
 * WS-6 — Audit log.
 * Confirma que eventos de tracking rejeitados chamam app_write_audit_log
 * com o organization_id resolvido, e sem vazar o public key.
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

describe("Audit log — WS-6", () => {
  beforeEach(() => {
    resetSupabaseState();
    supabaseAdminMock.from.mockClear();
    supabaseAdminMock.rpc.mockClear();
  });
  afterEach(() => vi.clearAllMocks());

  it("writes TRACKING_REJECTED audit entry with the resolved org id when origin is not allowed", async () => {
    await withOrganization(async ({ organization }) => {
      supabaseState.responses["organizations:maybeSingle"] = {
        id: organization.id,
        tracking_allowed_origins: ["only-this.com"],
      };
      const Route = await loadRoute();
      await invokeHandler(
        Route,
        "POST",
        makeJsonRequest("http://api/api/public/track/event", {
          pk: "pk_valid_1234567",
          session_id: "sess_audit_1",
          event_name: "pageview",
        }, { headers: { origin: "https://evil.com" } }),
      );

      const audit = supabaseState.captured.find(
        (c) =>
          c.op === "rpc" &&
          (c.args as { name: string }).name === "app_write_audit_log",
      );
      expect(audit).toBeTruthy();
      const rpcArgs = (audit!.args as { args: Record<string, unknown> }).args;
      expect(rpcArgs._actor_org_id).toBe(organization.id);
      expect(rpcArgs._action).toBe("TRACKING_REJECTED");
      const payload = JSON.stringify(rpcArgs._new_data);
      // must not contain the public key or raw origin URL
      expect(payload).not.toContain("pk_valid_1234567");
    });
  });

  it("audit rpc failure never propagates — public caller still gets 403", async () => {
    await withOrganization(async ({ organization }) => {
      supabaseState.responses["organizations:maybeSingle"] = {
        id: organization.id,
        tracking_allowed_origins: ["only-this.com"],
      };
      supabaseAdminMock.rpc.mockImplementationOnce(async () => {
        throw new Error("db-down");
      });
      const Route = await loadRoute();
      const res = await invokeHandler(
        Route, "POST",
        makeJsonRequest("http://api/api/public/track/event", {
          pk: "pk_valid_1234567", session_id: "sess_audit_2", event_name: "pageview",
        }, { headers: { origin: "https://evil.com" } }),
      );
      expect(res.status).toBe(403);
    });
  });
});
