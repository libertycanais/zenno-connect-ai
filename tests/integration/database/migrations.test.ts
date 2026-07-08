/**
 * WS-7 — Migrations sanity: expected tables, defaults, enums.
 */
import { describe, expect, it } from "vitest";
import { HAS_PG, psql, psqlColumn, psqlScalar } from "@tests/helpers/pg";

const EXPECTED_TABLES = [
  "active_client_selections",
  "ai_copilot_conversations",
  "ai_copilot_messages",
  "ai_copilot_pending_actions",
  "audit_log",
  "automation_runs",
  "automations",
  "finance_categories",
  "finance_transactions",
  "global_rate_limits",
  "google_ad_accounts",
  "google_ads_campaigns",
  "google_ads_conversions",
  "google_ads_insights",
  "lead_activities",
  "lead_tag_assignments",
  "lead_tags",
  "leads",
  "meta_ad_accounts",
  "meta_ads_insights",
  "meta_campaigns",
  "meta_conversion_events",
  "oauth_states",
  "organizations",
  "payment_integrations",
  "profiles",
  "sigma_integrations",
  "sigma_requests",
  "subscriptions",
  "ticket_messages",
  "tickets",
  "tracking_events",
  "tracking_leads",
  "tracking_rate_limits",
  "user_roles",
  "whatsapp_chats",
  "whatsapp_instances",
  "whatsapp_messages",
  "whatsapp_tracking_codes",
] as const;

describe.skipIf(!HAS_PG)("WS-7 — migrations", () => {
  it("every expected table exists in public", () => {
    const present = new Set(
      psqlColumn(
        `select relname from pg_class where relkind in ('r','p')
           and relnamespace='public'::regnamespace`,
      ),
    );
    for (const t of EXPECTED_TABLES) {
      expect(present.has(t), `missing table: ${t}`).toBe(true);
    }
  });

  it("organizations.tracking_public_key has generator default", () => {
    const def = psqlScalar(
      `select column_default from information_schema.columns
        where table_schema='public' and table_name='organizations'
          and column_name='tracking_public_key'`,
    );
    expect(def).toContain("gen_random_uuid");
  });

  it("organizations.tracking_allowed_origins defaults to empty text[]", () => {
    const def = psqlScalar(
      `select column_default from information_schema.columns
        where table_schema='public' and table_name='organizations'
          and column_name='tracking_allowed_origins'`,
    );
    expect(def).toContain("ARRAY[]");
  });

  it("id columns default to gen_random_uuid() on core tables", () => {
    for (const t of ["organizations", "leads", "tickets", "whatsapp_chats", "tracking_events"]) {
      const def = psqlScalar(
        `select column_default from information_schema.columns
          where table_schema='public' and table_name='${t}' and column_name='id'`,
      );
      expect(def, `${t}.id default`).toContain("gen_random_uuid");
    }
  });

  it("app_role enum has the expected 4 members", () => {
    const rows = psql(
      `select e.enumlabel
         from pg_type t
         join pg_enum e on e.enumtypid = t.oid
        where t.typname='app_role' order by e.enumsortorder`,
    ).map((r) => r[0]);
    expect(rows).toEqual(["owner", "admin", "manager", "agent"]);
  });

  it("audit_log has month partitions covering current + next 6 months", () => {
    const cnt = psqlScalar(
      `select count(*)::int from pg_class
        where relispartition and relnamespace='public'::regnamespace
          and relname like 'audit_log_%' and relkind='r'`,
    );
    expect(Number(cnt)).toBeGreaterThanOrEqual(6);
  });
});
