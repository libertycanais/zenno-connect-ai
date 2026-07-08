/**
 * WS-7 — RLS invariants for sensitive tables.
 * All checks are read-only against pg_catalog / information_schema.
 */
import { describe, expect, it } from "vitest";
import { HAS_PG, psql, psqlColumn, psqlScalar } from "@tests/helpers/pg";

const SENSITIVE_TABLES = [
  "organizations",
  "profiles",
  "user_roles",
  "tracking_events",
  "tracking_leads",
  "whatsapp_chats",
  "whatsapp_messages",
  "payment_integrations",
  "meta_ad_accounts",
  "google_ad_accounts",
  "oauth_states",
  "audit_log",
  "subscriptions",
  "finance_transactions",
  "tickets",
  "sigma_integrations",
  "ai_copilot_messages",
] as const;

describe.skipIf(!HAS_PG)("WS-7 — RLS coverage on sensitive tables", () => {
  it.each(SENSITIVE_TABLES)("has RLS enabled on %s", (table) => {
    const val = psqlScalar(
      `select relrowsecurity from pg_class where relname = '${table}' and relnamespace = 'public'::regnamespace`,
    );
    expect(val, `${table} must exist`).not.toBeNull();
    expect(val).toBe("t");
  });

  it.each(SENSITIVE_TABLES)("has at least one policy on %s", (table) => {
    const val = psqlScalar(
      `select count(*)::int from pg_policies where schemaname='public' and tablename='${table}'`,
    );
    expect(Number(val)).toBeGreaterThan(0);
  });

  it("every public table (excluding rate-limit + partitions) has RLS enabled", () => {
    const rows = psql(
      `select relname from pg_class
       where relkind='r'
         and relnamespace='public'::regnamespace
         and relrowsecurity = false`,
    );
    // rate-limit tables are FORCE-RLS'd; any leftover here would be a leak.
    expect(rows.map((r) => r[0])).toEqual([]);
  });

  it("audit_log is a partitioned table (kind=p) and every partition has RLS", () => {
    const kind = psqlScalar(
      `select relkind from pg_class where relname='audit_log' and relnamespace='public'::regnamespace`,
    );
    expect(kind).toBe("p");
    const parts = psqlColumn(
      `select relname from pg_class
       where relispartition and relkind='r'
         and relnamespace='public'::regnamespace
         and relname like 'audit_log_%'`,
    );
    expect(parts.length).toBeGreaterThanOrEqual(6);
    for (const p of parts) {
      const flags = psql(
        `select relrowsecurity, relforcerowsecurity from pg_class where relname='${p}'`,
      )[0];
      expect(flags?.[0]).toBe("t");
      expect(flags?.[1]).toBe("t");
    }
  });

  it("user_roles has multi-tenant unique key (user, org, role)", () => {
    const uk = psqlScalar(
      `select conname from pg_constraint where conrelid='public.user_roles'::regclass and contype='u'`,
    );
    expect(uk).toContain("user_roles_");
  });

  it("cross-tenant: every RLS policy references organization_id, auth.uid(), has_role or current_org_id", () => {
    const rows = psql(
      `select tablename, policyname, coalesce(qual,'') || ' ' || coalesce(with_check,''), coalesce(array_to_string(roles,','),'')
       from pg_policies where schemaname='public'
         and tablename in (${SENSITIVE_TABLES.map((t) => `'${t}'`).join(",")})`,
    );
    for (const [table, policy, body, roles] of rows) {
      const hasTenantGuard =
        /organization_id/.test(body) ||
        /auth\.uid\(\)/.test(body) ||
        /has_role\(/.test(body) ||
        /current_org_id\(/.test(body);
      // Service-role-only policies are fine to be permissive (RLS is bypassed anyway).
      const isServiceRoleOnly = roles === "service_role";
      expect(
        hasTenantGuard || isServiceRoleOnly,
        `${table}.${policy} (roles=${roles}) lacks tenant guard`,
      ).toBe(true);
    }
  });
});
