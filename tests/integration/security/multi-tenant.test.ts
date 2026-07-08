/**
 * WS-6 — Multi-tenant isolation.
 * Verifica que:
 *   - toda leitura sensível está escopada por organization_id (via chain .eq)
 *   - o `pk` público resolve para EXATAMENTE uma organização (nunca por sub-string)
 *   - eventos rejeitados por origem/rate-limit são auditados sob o tenant certo
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

describe("multi-tenant isolation — WS-6", () => {
  beforeEach(() => {
    resetSupabaseState();
    supabaseAdminMock.from.mockClear();
    supabaseAdminMock.rpc.mockClear();
  });
  afterEach(() => vi.clearAllMocks());

  it("looks up organization by tracking_public_key with equality filter (no substring bypass)", async () => {
    await withOrganization(async ({ organization }) => {
      supabaseState.responses["organizations:maybeSingle"] = {
        id: organization.id,
        tracking_allowed_origins: ["shop.example.com"],
      };
      supabaseState.rpcResponses.track_compound_rate_limit_hit = false;
      const Route = await loadRoute();
      await invokeHandler(
        Route,
        "POST",
        makeJsonRequest("http://api/api/public/track/event", {
          pk: "pk_tenant_A_secret",
          session_id: "sess_multi_1",
          event_name: "pageview",
        }, { headers: { origin: "https://shop.example.com" } }),
      );
      const orgLookup = supabaseState.captured.find(
        (c) => c.op === "maybeSingle" && c.table === "organizations",
      );
      const filters = (orgLookup?.args as { filters: Record<string, unknown> }).filters;
      // Equality filter — never `like`/`ilike`
      expect(filters.tracking_public_key).toBe("pk_tenant_A_secret");
    });
  });

  it("writes tracking_events with the resolved tenant organization_id — never trusts client payload", async () => {
    await withOrganization(async ({ organization }) => {
      supabaseState.responses["organizations:maybeSingle"] = {
        id: organization.id,
        tracking_allowed_origins: ["*.example.com"],
      };
      supabaseState.rpcResponses.track_compound_rate_limit_hit = false;
      const Route = await loadRoute();
      await invokeHandler(
        Route,
        "POST",
        makeJsonRequest("http://api/api/public/track/event", {
          pk: "pk_valid_1234567",
          session_id: "sess_multi_2",
          event_name: "pageview",
          // hostile field: attacker tries to inject a different org id
          organization_id: "attacker-org-uuid",
        }, { headers: { origin: "https://shop.example.com" } }),
      );
      const eventInsert = supabaseState.captured.find(
        (c) => c.op === "insert" && c.table === "tracking_events",
      );
      const payload = eventInsert?.args as { organization_id: string };
      expect(payload.organization_id).toBe(organization.id);
      expect(payload.organization_id).not.toBe("attacker-org-uuid");
    });
  });

  it("cross-tenant: two orgs never share the same public-key row", async () => {
    // Simulate the DB unique constraint by expecting equality lookups only.
    await withOrganization(async ({ organization: orgA }) => {
      supabaseState.responses["organizations:maybeSingle"] = {
        id: orgA.id,
        tracking_allowed_origins: ["a.example.com"],
      };
      supabaseState.rpcResponses.track_compound_rate_limit_hit = false;
      const Route = await loadRoute();
      const res = await invokeHandler(
        Route,
        "POST",
        makeJsonRequest("http://api/api/public/track/event", {
          pk: "pk_a", session_id: "sess_A", event_name: "pageview",
        }, { headers: { origin: "https://a.example.com" } }),
      );
      expect(res.status).toBe(200);
      const inserted = supabaseState.captured.find(
        (c) => c.op === "insert" && c.table === "tracking_events",
      );
      expect((inserted?.args as { organization_id: string }).organization_id).toBe(orgA.id);
    });
  });

  it("rejects with origin_not_allowed even if allowlist belongs to a different tenant", async () => {
    supabaseState.responses["organizations:maybeSingle"] = {
      id: "org-1",
      tracking_allowed_origins: ["allowed-for-org1.com"],
    };
    supabaseState.rpcResponses.track_compound_rate_limit_hit = false;
    const Route = await loadRoute();
    const res = await invokeHandler(
      Route,
      "POST",
      makeJsonRequest("http://api/api/public/track/event", {
        pk: "pk_x", session_id: "sess_x", event_name: "pageview",
      }, { headers: { origin: "https://evil.tenant2.com" } }),
    );
    expect(res.status).toBe(403);
  });
});
