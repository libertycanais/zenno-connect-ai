import { uuid } from "@tests/helpers/id";

export type LeadStatus = "new" | "contacted" | "qualified" | "won" | "lost";

export type LeadFixture = {
  id: string;
  organization_id: string;
  name: string;
  phone: string;
  email: string | null;
  status: LeadStatus;
  source: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  created_at: string;
};

export function leadFixture(overrides: Partial<LeadFixture> = {}): LeadFixture {
  const id = overrides.id ?? uuid("lead");
  return {
    id,
    organization_id: overrides.organization_id ?? uuid("org"),
    name: overrides.name ?? "Lead Fixture",
    phone: overrides.phone ?? "+5511999990000",
    email: overrides.email ?? null,
    status: overrides.status ?? "new",
    source: overrides.source ?? "whatsapp",
    utm_source: overrides.utm_source ?? "meta",
    utm_medium: overrides.utm_medium ?? "cpc",
    utm_campaign: overrides.utm_campaign ?? "test-campaign",
    created_at: overrides.created_at ?? new Date().toISOString(),
  };
}
