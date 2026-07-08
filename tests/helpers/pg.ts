/**
 * Small psql wrapper for WS-7 database inspection tests.
 * All calls are read-only (SELECT from catalogs). Auto-skips when PGHOST is
 * not present so the suite can still run in envs without a live DB.
 */
import { execFileSync } from "node:child_process";

export const HAS_PG = Boolean(process.env.PGHOST);

export type Row = Record<string, string>;

/** Run a SQL query and return rows as arrays of pipe-delimited fields. */
export function psql(sql: string): string[][] {
  const out = execFileSync(
    "psql",
    ["-tAF|", "-v", "ON_ERROR_STOP=1", "-c", sql],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  return out
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => l.split("|"));
}

/** Convenience: single scalar value (first col of first row) as string. */
export function psqlScalar(sql: string): string | null {
  const rows = psql(sql);
  return rows[0]?.[0] ?? null;
}

/** Convenience: single column as array of strings. */
export function psqlColumn(sql: string): string[] {
  return psql(sql).map((r) => r[0]);
}
