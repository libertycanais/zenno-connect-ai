/**
 * Mock tipado do Supabase client — cobre o subset usado por server functions:
 * from().select().eq().single(), insert, update, delete, rpc, auth.getUser.
 *
 * Uso:
 *   const supabase = createSupabaseMock({
 *     from: {
 *       leads: { select: [leadFixture()] },
 *     },
 *   });
 */
import { vi } from "vitest";

type QueryResult<T = unknown> = { data: T | null; error: null | { message: string } };

type TableMock = {
  select?: unknown[];
  insert?: unknown;
  update?: unknown;
  delete?: unknown;
  single?: unknown;
  error?: string;
};

export type SupabaseMockConfig = {
  from?: Record<string, TableMock>;
  rpc?: Record<string, unknown>;
  authUser?: { id: string; email?: string } | null;
};

export function createSupabaseMock(config: SupabaseMockConfig = {}) {
  const build = (table: string) => {
    const t = config.from?.[table] ?? {};
    const result = <T>(data: T): QueryResult<T> =>
      t.error ? { data: null, error: { message: t.error } } : { data, error: null };

    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    const self = new Proxy(chain, {
      get(_target, prop: string) {
        if (prop === "then") return undefined;
        if (prop === "single" || prop === "maybeSingle") {
          return vi.fn(async () => result((t.single ?? t.select?.[0]) as unknown));
        }
        if (prop === "insert") return vi.fn(async () => result(t.insert));
        if (prop === "update") return vi.fn(() => self);
        if (prop === "delete") return vi.fn(() => self);
        if (prop === "select") return vi.fn(() => self);
        // Terminal awaits: return array select
        chain[prop] ??= vi.fn(() => self);
        return chain[prop];
      },
    });

    // Make the chain awaitable to yield the select array.
    (self as unknown as PromiseLike<QueryResult<unknown[]>>).then = ((
      onfulfilled?: (v: QueryResult<unknown[]>) => unknown,
    ) => Promise.resolve(result(t.select ?? [])).then(onfulfilled)) as never;

    return self;
  };

  return {
    from: vi.fn((table: string) => build(table)),
    rpc: vi.fn(async (name: string) => ({
      data: config.rpc?.[name] ?? null,
      error: null,
    })),
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: config.authUser ?? null },
        error: null,
      })),
      getSession: vi.fn(async () => ({
        data: { session: config.authUser ? { user: config.authUser } : null },
        error: null,
      })),
    },
  };
}

export type SupabaseMock = ReturnType<typeof createSupabaseMock>;
