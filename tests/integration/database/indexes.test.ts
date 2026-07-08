/**
 * WS-7 — Critical index coverage.
 */
import { describe, expect, it } from "vitest";
import { HAS_PG, psqlColumn } from "@tests/helpers/pg";

const REQUIRED_INDEXES: Array<[string, RegExp]> = [
  ["tracking_events", /organization_id|org_created/i],
  ["tracking_events", /session/i],
  ["tracking_events", /fbclid/i],
  ["tracking_events", /gclid/i],
  ["tracking_leads", /organization_id|org_/i],
  ["tracking_leads", /email/i],
  ["tracking_leads", /phone/i],
  ["oauth_states", /state|expires|provider/i],
  ["audit_log_2026_07", /actor_org_id|created_at/i],
  ["audit_log_2026_07", /entity/i],
  ["audit_log_2026_07", /request_id/i],
  ["user_roles", /user_id|organization_id|role/i],
  ["payment_integrations", /organization_id|provider/i],
  ["meta_ad_accounts", /organization_id|ad_account_id/i],
  ["google_ad_accounts", /organization_id|customer_id/i],
  ["tracking_rate_limits", /organization_id|ip|bucket/i],
  ["global_rate_limits", /key|window/i],
];

describe.skipIf(!HAS_PG)("WS-7 — critical indexes", () => {
  it.each(REQUIRED_INDEXES)("%s has an index matching %s", (table, pattern) => {
    const idx = psqlColumn(
      `select indexname from pg_indexes where schemaname='public' and tablename='${table}'`,
    );
    expect(idx.length, `${table} has no indexes`).toBeGreaterThan(0);
    expect(
      idx.some((i) => pattern.test(i)),
      `no index on ${table} matching ${pattern}, got: ${idx.join(", ")}`,
    ).toBe(true);
  });

  it("total public.* index count is within a healthy range (>100)", () => {
    const count = psqlColumn(
      `select count(*)::int from pg_indexes where schemaname='public'`,
    )[0];
    expect(Number(count)).toBeGreaterThan(100);
  });
});
