/**
 * Auth helper para testes de server functions autenticadas.
 * Reproduz o shape que `requireSupabaseAuth` injeta em `context`.
 * Puramente aditivo — não altera o middleware real.
 */
import { vi } from "vitest";
import { uuid } from "./id";

export type FakeClaims = {
  sub: string;
  email?: string;
  role?: string;
  aud?: string;
  exp?: number;
};

export type FakeAuthContext = {
  userId: string;
  claims: FakeClaims;
  supabase: {
    from: ReturnType<typeof vi.fn>;
    rpc: ReturnType<typeof vi.fn>;
    auth: { getClaims: ReturnType<typeof vi.fn> };
  };
};

type ProfileRow = { id: string; organization_id: string };
type RoleRow = { role: "owner" | "admin" | "member" | "viewer" };

export function withAuthenticatedUser(
  overrides: {
    userId?: string;
    organizationId?: string;
    roles?: RoleRow["role"][];
    email?: string;
  } = {},
): FakeAuthContext {
  const userId = overrides.userId ?? uuid("user");
  const organizationId = overrides.organizationId ?? uuid("org");
  const roles: RoleRow[] = (overrides.roles ?? ["member"]).map((r) => ({ role: r }));
  const email = overrides.email ?? `user-${userId.slice(0, 6)}@test.local`;

  const tables: Record<string, unknown> = {
    profiles: { id: userId, organization_id: organizationId } satisfies ProfileRow,
    user_roles: roles,
  };

  const makeChain = (table: string): Record<string, unknown> => {
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = () => chain;
    chain.in = () => chain;
    chain.limit = () => chain;
    chain.order = () => chain;
    chain.single = async () => ({ data: tables[table] ?? null, error: null });
    chain.maybeSingle = async () => ({ data: tables[table] ?? null, error: null });
    (chain as unknown as PromiseLike<unknown>).then = ((
      resolve?: (v: unknown) => unknown,
    ) =>
      Promise.resolve({ data: Array.isArray(tables[table]) ? tables[table] : [tables[table]], error: null }).then(
        resolve,
      )) as never;
    return chain;
  };

  return {
    userId,
    claims: { sub: userId, email, role: "authenticated" },
    supabase: {
      from: vi.fn((table: string) => makeChain(table)),
      rpc: vi.fn(async () => ({ data: null, error: null })),
      auth: {
        getClaims: vi.fn(async () => ({
          data: { claims: { sub: userId, email } },
          error: null,
        })),
      },
    },
  };
}
