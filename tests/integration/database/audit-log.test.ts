/**
 * WS-7 — Audit log invariants (append-only, partitioned, redaction).
 */
import { describe, expect, it } from "vitest";
import { HAS_PG, psql, psqlColumn, psqlScalar } from "@tests/helpers/pg";

describe.skipIf(!HAS_PG)("WS-7 — audit_log append-only + partitions", () => {
  it("audit_log is partitioned by month (PARTITION BY RANGE)", () => {
    const strat = psqlScalar(
      `select pt.partstrat::text
         from pg_partitioned_table pt
         join pg_class c on c.oid = pt.partrelid
        where c.relname='audit_log' and c.relnamespace='public'::regnamespace`,
    );
    expect(strat).toBe("r"); // range
  });

  it("every audit_log partition has BEFORE UPDATE + BEFORE DELETE block triggers", () => {
    const parts = psqlColumn(
      `select relname from pg_class
        where relispartition and relnamespace='public'::regnamespace
          and relname like 'audit_log_%' and relkind='r'`,
    );
    expect(parts.length).toBeGreaterThanOrEqual(6);
    for (const p of parts) {
      const trigs = psqlColumn(
        `select trigger_name from information_schema.triggers
           where event_object_schema='public' and event_object_table='${p}'`,
      );
      expect(trigs, `${p} missing block triggers`).toEqual(
        expect.arrayContaining(["audit_log_no_delete", "audit_log_no_update"]),
      );
    }
  });

  it("audit_redact() is IMMUTABLE and redacts known secret keys", () => {
    const vol = psqlScalar(
      `select provolatile from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname='audit_redact'`,
    );
    expect(vol).toBe("i"); // IMMUTABLE

    const redacted = psqlScalar(
      `select public.audit_redact(jsonb_build_object(
         'access_token','SECRET','webhook_secret','X','safe','ok'))::text`,
    );
    expect(redacted).toContain("[REDACTED]");
    expect(redacted).not.toContain("SECRET");
    expect(redacted).not.toContain('"X"');
    expect(redacted).toContain('"safe": "ok"');
  });

  it("audit_log has the expected column set (actor/entity/request/trace/ip)", () => {
    const cols = psqlColumn(
      `select column_name from information_schema.columns
        where table_schema='public' and table_name='audit_log' order by column_name`,
    );
    for (const c of [
      "id", "action", "actor_user_id", "actor_org_id",
      "entity_type", "entity_id", "old_data", "new_data",
      "request_id", "trace_id", "ip", "user_agent", "created_at",
    ]) {
      expect(cols, `audit_log missing ${c}`).toContain(c);
    }
  });

  it("attempting UPDATE on audit_log raises 'append-only' via the trigger", () => {
    // psql exits non-zero when the statement raises, so use a try/catch.
    let msg = "";
    try {
      psql(`update public.audit_log set action = action where false`);
    } catch (e) {
      msg = e instanceof Error ? e.message : String(e);
    }
    expect(msg).toContain("append-only");
  });
});
