import { uuid } from "@tests/helpers/id";

export type UserRole = "owner" | "admin" | "member" | "viewer";

export type UserFixture = {
  id: string;
  organization_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
};

export function userFixture(overrides: Partial<UserFixture> = {}): UserFixture {
  const id = overrides.id ?? uuid("user");
  return {
    id,
    organization_id: overrides.organization_id ?? uuid("org"),
    email: overrides.email ?? `user-${id.slice(0, 8)}@example.com`,
    full_name: overrides.full_name ?? "Test User",
    role: overrides.role ?? "member",
    created_at: overrides.created_at ?? new Date("2025-01-01T00:00:00Z").toISOString(),
  };
}
