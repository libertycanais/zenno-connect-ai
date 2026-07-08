/**
 * WS-8 — Audit Log payload contract
 *
 * O RPC `app_write_audit_log` é o único caminho de escrita permitido no
 * `audit_log`. Sua assinatura é parte do contrato interno crítico: qualquer
 * mudança quebra os triggers e a Provider Layer.
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

const AUDIT_RPC_KEYS = [
  "_action",
  "_actor_org_id",
  "_actor_user_id",
  "_entity_id",
  "_entity_type",
  "_ip",
  "_new_data",
  "_old_data",
  "_request_id",
  "_trace_id",
  "_user_agent",
];

describe("Contract: app_write_audit_log RPC signature", () => {
  beforeEach(() => {
    resetSupabaseState();
    supabaseAdminMock.rpc.mockClear();
  });
  afterEach(() => vi.clearAllMocks());

  it("audit call from tracking dispatch uses the frozen argument shape", async () => {
    await withOrganization(async ({ organization }) => {
      supabaseState.responses["organizations:maybeSingle"] = {
        id: organization.id,
        tracking_allowed_origins: ["different.com"],
      };
      const { Route } = await import("@/routes/api/public/track.event");
      const req = makeJsonRequest(
        "http://x/api/public/track/event",
        { pk: "pk_test_valid_123456", session_id: "sess_abcdefgh_1234", event_name: "pageview" },
        { headers: { origin: "https://shop.example.com" } },
      );
      const res = await invokeHandler(Route, "POST", req);
      expect(res.status).toBe(403);

      const rpc = supabaseState.captured.find(
        (c) => c.op === "rpc" && (c.args as { name: string }).name === "app_write_audit_log",
      );
      expect(rpc).toBeDefined();
      const args = (rpc?.args as { args: Record<string, unknown> }).args;
      // All contract keys must exist (missing key = breaking change)
      for (const key of AUDIT_RPC_KEYS) {
        expect(args).toHaveProperty(key);
      }
      // No extra unknown fields (extra key = breaking change)
      expect(Object.keys(args).sort()).toEqual(AUDIT_RPC_KEYS);
    });
  });
});
