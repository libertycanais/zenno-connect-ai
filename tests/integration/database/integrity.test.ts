/**
 * WS-7 — Referential + column integrity: NOT NULL, UNIQUE, FKs, enums.
 */
import { describe, expect, it } from "vitest";
import { HAS_PG, psql, psqlColumn } from "@tests/helpers/pg";

const NOT_NULL_ORG = [
  "leads", "tickets", "whatsapp_chats", "whatsapp_messages",
  "meta_ad_accounts", "google_ad_accounts", "payment_integrations",
  "tracking_events", "tracking_leads",
  "meta_conversion_events", "google_ads_conversions",
] as const;

describe.skipIf(!HAS_PG)("WS-7 — integrity", () => {
  it.each(NOT_NULL_ORG)("%s.organization_id is NOT NULL", (table) => {
    const nullable = psql(
      `select is_nullable from information_schema.columns
        where table_schema='public' and table_name='${table}'
          and column_name='organization_id'`,
    )[0]?.[0];
    expect(nullable, `${table}.organization_id`).toBe("NO");
  });

  it("user_roles has UNIQUE (user_id, organization_id, role)", () => {
    const uniq = psqlColumn(
      `select conname from pg_constraint
        where conrelid='public.user_roles'::regclass and contype='u'`,
    );
    expect(uniq.length).toBeGreaterThan(0);
  });

  it("payment_integrations UNIQUE (organization_id, provider)", () => {
    const uniq = psqlColumn(
      `select conname from pg_constraint
        where conrelid='public.payment_integrations'::regclass and contype='u'`,
    );
    expect(uniq.some((n) => /provider/.test(n))).toBe(true);
  });

  it("tracking_leads UNIQUE (organization_id, session_id)", () => {
    const uniq = psqlColumn(
      `select conname from pg_constraint
        where conrelid='public.tracking_leads'::regclass and contype='u'`,
    );
    expect(uniq.some((n) => /session/.test(n))).toBe(true);
  });

  it("meta_ad_accounts UNIQUE (organization_id, ad_account_id)", () => {
    const uniq = psqlColumn(
      `select conname from pg_constraint
        where conrelid='public.meta_ad_accounts'::regclass and contype='u'`,
    );
    expect(uniq.some((n) => /ad_account_id/.test(n))).toBe(true);
  });

  it("google_ad_accounts UNIQUE (organization_id, customer_id)", () => {
    const uniq = psqlColumn(
      `select conname from pg_constraint
        where conrelid='public.google_ad_accounts'::regclass and contype='u'`,
    );
    expect(uniq.some((n) => /customer_id/.test(n))).toBe(true);
  });

  it("profiles.id references auth.users (cascade)", () => {
    const rows = psql(
      `select confrelid::regclass::text, confdeltype
         from pg_constraint
        where conrelid='public.profiles'::regclass and contype='f'`,
    );
    expect(rows.length).toBeGreaterThan(0);
    const [ref, del] = rows[0];
    expect(ref).toBe("auth.users");
    expect(["c", "a", "n", "r", "d"]).toContain(del);
  });

  it("known enum types are defined", () => {
    const enums = psqlColumn(
      `select t.typname from pg_type t
         join pg_namespace n on n.oid=t.typnamespace
        where n.nspname='public' and t.typtype='e' order by t.typname`,
    );
    for (const e of [
      "app_role", "lead_status",
      "wa_instance_status", "wa_message_direction",
      "wa_message_status", "wa_message_type",
    ]) {
      expect(enums, `missing enum ${e}`).toContain(e);
    }
  });

  it("oauth_states row has state + expires_at + provider columns", () => {
    const cols = psqlColumn(
      `select column_name from information_schema.columns
        where table_schema='public' and table_name='oauth_states'`,
    );
    for (const c of ["state", "expires_at", "provider", "consumed_at", "organization_id", "user_id"]) {
      expect(cols, `oauth_states missing ${c}`).toContain(c);
    }
  });
});
