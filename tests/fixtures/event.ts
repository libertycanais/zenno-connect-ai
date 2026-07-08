import { uuid } from "@tests/helpers/id";

export type TrackingEventFixture = {
  id: string;
  organization_id: string;
  public_key: string;
  visitor_id: string;
  session_id: string;
  event_name: string;
  url: string;
  referrer: string | null;
  utm: Record<string, string | null>;
  properties: Record<string, unknown>;
  occurred_at: string;
};

export function eventFixture(
  overrides: Partial<TrackingEventFixture> = {},
): TrackingEventFixture {
  const id = overrides.id ?? uuid("evt");
  return {
    id,
    organization_id: overrides.organization_id ?? uuid("org"),
    public_key: overrides.public_key ?? "pk_test_1234567890",
    visitor_id: overrides.visitor_id ?? uuid("visitor"),
    session_id: overrides.session_id ?? uuid("sess"),
    event_name: overrides.event_name ?? "pageview",
    url: overrides.url ?? "https://example.com/",
    referrer: overrides.referrer ?? null,
    utm: overrides.utm ?? {
      utm_source: "meta",
      utm_medium: "cpc",
      utm_campaign: "test",
      utm_term: null,
      utm_content: null,
    },
    properties: overrides.properties ?? {},
    occurred_at: overrides.occurred_at ?? new Date().toISOString(),
  };
}
