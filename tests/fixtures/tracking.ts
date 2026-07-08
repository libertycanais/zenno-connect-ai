import { uuid } from "@tests/helpers/id";

export type TrackingSiteFixture = {
  id: string;
  organization_id: string;
  public_key: string;
  allowed_origins: string[];
  created_at: string;
};

export function trackingSiteFixture(
  overrides: Partial<TrackingSiteFixture> = {},
): TrackingSiteFixture {
  const id = overrides.id ?? uuid("site");
  return {
    id,
    organization_id: overrides.organization_id ?? uuid("org"),
    public_key: overrides.public_key ?? `pk_test_${id.slice(0, 8)}`,
    allowed_origins: overrides.allowed_origins ?? ["example.com", "*.example.com"],
    created_at: overrides.created_at ?? new Date().toISOString(),
  };
}
