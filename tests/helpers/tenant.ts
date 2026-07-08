/**
 * Utilitários multi-tenant para testes.
 * Todo teste que toca dados deve rodar dentro de `withOrganization()` para
 * garantir isolamento e refletir a topologia RLS real de produção.
 */
import type { ProviderContext } from "@/providers/common/provider.types";
import { organizationFixture, type OrganizationFixture } from "@tests/fixtures/organization";
import { userFixture, type UserFixture } from "@tests/fixtures/user";
import { uuid } from "./id";

export type TenantContext = {
  organization: OrganizationFixture;
  owner: UserFixture;
  providerContext: ProviderContext;
};

export function makeTenantContext(overrides?: {
  organization?: Partial<OrganizationFixture>;
  owner?: Partial<UserFixture>;
}): TenantContext {
  const organization = organizationFixture(overrides?.organization);
  const owner = userFixture({
    organization_id: organization.id,
    role: "owner",
    ...overrides?.owner,
  });
  return {
    organization,
    owner,
    providerContext: {
      organizationId: organization.id,
      userId: owner.id,
      requestId: uuid("req"),
      traceId: uuid("trace"),
    },
  };
}

export async function withOrganization<T>(
  fn: (ctx: TenantContext) => Promise<T> | T,
  overrides?: Parameters<typeof makeTenantContext>[0],
): Promise<T> {
  const ctx = makeTenantContext(overrides);
  return await fn(ctx);
}
