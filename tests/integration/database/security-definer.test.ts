/**
 * WS-7 — SECURITY DEFINER surface.
 * Enforce an allowlist, ensure search_path is pinned to pg_catalog,public,
 * and that the functions we rely on exist with the expected signatures.
 */
import { describe, expect, it } from "vitest";
import { HAS_PG, psql, psqlColumn } from "@tests/helpers/pg";

const EXPECTED = new Set([
  "ai_context_cache_cleanup", // P0.6 Wave 1 — AI context cache pruning
  "app_write_audit_log",
  "audit_log_ensure_partition",
  "audit_log_prune_partitions",
  "audit_row_change",
  "create_default_subscription",
  "current_org_id",
  "global_rate_limit_hit",
  "handle_new_user",
  "has_role",
  "track_compound_rate_limit_hit",
  "track_rate_limit_hit",
]);

describe.skipIf(!HAS_PG)("WS-7 — SECURITY DEFINER contract", () => {
  it("no unexpected SECURITY DEFINER function in public schema", () => {
    const names = psqlColumn(
      `select p.proname
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname='public' and p.prosecdef order by p.proname`,
    );
    for (const name of names) {
      expect(EXPECTED.has(name), `unexpected SECURITY DEFINER: ${name}`).toBe(true);
    }
    for (const required of EXPECTED) {
      expect(names, `missing SECURITY DEFINER: ${required}`).toContain(required);
    }
  });

  it("every SECURITY DEFINER function pins search_path to pg_catalog, public", () => {
    const rows = psql(
      `select p.proname, coalesce(array_to_string(p.proconfig,';'),'')
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname='public' and p.prosecdef`,
    );
    for (const [name, cfg] of rows) {
      expect(cfg, `${name} missing search_path`).toContain("search_path=");
      expect(cfg, `${name} search_path must include pg_catalog`).toContain("pg_catalog");
      expect(cfg, `${name} search_path must include public`).toContain("public");
    }
  });

  it("has_role(uuid, app_role, uuid) is 3-arg tenant-scoped", () => {
    const sig = psql(
      `select pg_get_function_identity_arguments(p.oid)
         from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname='has_role'`,
    )[0]?.[0];
    expect(sig).toBe("_user_id uuid, _role app_role, _org_id uuid");
  });

  it("current_org_id() takes no arguments and is STABLE SECURITY DEFINER", () => {
    const row = psql(
      `select provolatile, prosecdef, pronargs
         from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname='current_org_id'`,
    )[0];
    expect(row?.[0]).toBe("s"); // STABLE
    expect(row?.[1]).toBe("t"); // SECURITY DEFINER
    expect(row?.[2]).toBe("0");
  });

  it("app_write_audit_log has the expected 11-arg signature", () => {
    const sig = psql(
      `select pg_get_function_identity_arguments(p.oid)
         from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname='app_write_audit_log'`,
    )[0]?.[0] ?? "";
    expect(sig).toContain("_actor_user_id uuid");
    expect(sig).toContain("_actor_org_id uuid");
    expect(sig).toContain("_action text");
    expect(sig).toContain("_old_data jsonb");
    expect(sig).toContain("_new_data jsonb");
    expect(sig).toContain("_ip text");
  });

  it("global_rate_limit_hit + track_compound_rate_limit_hit exist and return boolean", () => {
    const rows = psql(
      `select p.proname, pg_catalog.format_type(p.prorettype, null)
         from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public'
          and p.proname in ('global_rate_limit_hit','track_compound_rate_limit_hit','track_rate_limit_hit')`,
    );
    expect(rows.length).toBe(3);
    for (const [, ret] of rows) expect(ret).toBe("boolean");
  });
});
