import { uuid } from "@tests/helpers/id";

export type OrganizationFixture = {
  id: string;
  name: string;
  slug: string;
  plan: "free" | "starter" | "pro" | "enterprise";
  created_at: string;
};

export function organizationFixture(
  overrides: Partial<OrganizationFixture> = {},
): OrganizationFixture {
  const id = overrides.id ?? uuid("org");
  return {
    id,
    name: overrides.name ?? "Acme Traffic Co",
    slug: overrides.slug ?? "acme-traffic-co",
    plan: overrides.plan ?? "pro",
    created_at: overrides.created_at ?? new Date("2025-01-01T00:00:00Z").toISOString(),
  };
}
