/**
 * Programmable double for `@/integrations/supabase/client.server`'s
 * `supabaseAdmin`. Supports the exact fluent chains used by public routes:
 *   .from(t).select(...).eq(...).eq(...).maybeSingle() / .single() / .limit().maybeSingle()
 *   .from(t).insert(payload)                          (awaitable)
 *   .from(t).insert(payload).select().single()        (upsert path)
 *   .from(t).update(payload).eq(col, val)             (awaitable)
 *   .from(t).upsert(rows, opts)                       (awaitable, may have .select().single())
 *   .rpc(name, args)
 *
 * Configure via `supabaseState.responses` / `supabaseState.rpcResponses`.
 * Inspect via `supabaseState.captured`.
 */
import { vi } from "vitest";

type Row = Record<string, unknown>;

type ReadKey = `${string}:single` | `${string}:maybeSingle`;

export const supabaseState = {
  responses: {} as Record<ReadKey | string, unknown>,
  rpcResponses: {} as Record<string, unknown>,
  insertError: {} as Record<string, { message: string } | null>,
  captured: [] as Array<{ op: string; table?: string; args?: unknown }>,
};

export function resetSupabaseState(): void {
  supabaseState.responses = {};
  supabaseState.rpcResponses = {};
  supabaseState.insertError = {};
  supabaseState.captured = [];
}

function terminal<T>(data: T | null, error: { message: string } | null = null) {
  return { data, error };
}

function makeAwaitable<T>(value: { data: T | null; error: { message: string } | null }) {
  // A thenable that resolves to Supabase-style { data, error }
  return {
    then<R>(onfulfilled?: (v: typeof value) => R) {
      return Promise.resolve(value).then(onfulfilled);
    },
  };
}

function makeChain(table: string) {
  const filters: Row = {};
  let selection: string | undefined;

  const chain: Record<string, unknown> = {};

  chain.select = (sel?: string) => {
    selection = sel;
    return chain;
  };
  chain.eq = (col: string, val: unknown) => {
    filters[col] = val;
    return chain;
  };
  chain.not = () => chain;
  chain.limit = () => chain;
  chain.order = () => chain;

  chain.maybeSingle = async () => {
    supabaseState.captured.push({
      op: "maybeSingle",
      table,
      args: { filters, selection },
    });
    return terminal(
      (supabaseState.responses[`${table}:maybeSingle`] ?? null) as unknown,
    );
  };
  chain.single = async () => {
    supabaseState.captured.push({
      op: "single",
      table,
      args: { filters, selection },
    });
    const data = supabaseState.responses[`${table}:single`] ?? null;
    return terminal(data, data ? null : { message: "not_found" });
  };

  chain.insert = (payload: unknown) => {
    supabaseState.captured.push({ op: "insert", table, args: payload });
    const err = supabaseState.insertError[table] ?? null;
    const result = terminal(supabaseState.responses[`${table}:insert`] ?? null, err);
    return {
      ...makeAwaitable(result),
      select: () => ({
        single: async () => result,
      }),
    };
  };

  chain.update = (payload: unknown) => {
    supabaseState.captured.push({ op: "update", table, args: payload });
    const result = terminal(null);
    return {
      eq: () => ({ ...makeAwaitable(result) }),
      ...makeAwaitable(result),
    };
  };

  chain.upsert = (rows: unknown, opts?: unknown) => {
    supabaseState.captured.push({ op: "upsert", table, args: { rows, opts } });
    const err = supabaseState.insertError[table] ?? null;
    const result = terminal(supabaseState.responses[`${table}:upsert`] ?? null, err);
    return {
      ...makeAwaitable(result),
      select: () => ({
        single: async () => result,
      }),
    };
  };

  return chain;
}

export const supabaseAdminMock = {
  from: vi.fn((table: string) => makeChain(table)),
  rpc: vi.fn(async (name: string, args: unknown) => {
    supabaseState.captured.push({ op: "rpc", args: { name, args } });
    return terminal(supabaseState.rpcResponses[name] ?? null);
  }),
};

/** Convenience: last insert payload for a given table. */
export function lastInsert(table: string): unknown {
  const inserts = supabaseState.captured.filter(
    (c) => c.op === "insert" && c.table === table,
  );
  return inserts[inserts.length - 1]?.args;
}

/** Convenience: all rpc calls with a given name. */
export function rpcCalls(name: string): Array<Record<string, unknown>> {
  return supabaseState.captured
    .filter((c) => c.op === "rpc")
    .map((c) => c.args as { name: string; args: Record<string, unknown> })
    .filter((c) => c.name === name)
    .map((c) => c.args);
}
