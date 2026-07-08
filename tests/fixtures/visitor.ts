import { uuid } from "@tests/helpers/id";

export type VisitorFixture = {
  id: string;
  organization_id: string;
  anonymous_id: string;
  session_id: string;
  first_seen_at: string;
  last_seen_at: string;
  user_agent: string;
  ip_hash: string;
};

export function visitorFixture(overrides: Partial<VisitorFixture> = {}): VisitorFixture {
  const id = overrides.id ?? uuid("visitor");
  return {
    id,
    organization_id: overrides.organization_id ?? uuid("org"),
    anonymous_id: overrides.anonymous_id ?? uuid("anon"),
    session_id: overrides.session_id ?? uuid("sess"),
    first_seen_at: overrides.first_seen_at ?? new Date().toISOString(),
    last_seen_at: overrides.last_seen_at ?? new Date().toISOString(),
    user_agent:
      overrides.user_agent ??
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    ip_hash: overrides.ip_hash ?? "hash_of_127_0_0_1",
  };
}
