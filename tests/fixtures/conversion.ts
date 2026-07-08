import { uuid } from "@tests/helpers/id";

export type ConversionFixture = {
  id: string;
  organization_id: string;
  lead_id: string | null;
  event_name: string;
  value: number;
  currency: string;
  occurred_at: string;
  provider: "meta" | "google_ads";
  external_id: string | null;
};

export function conversionFixture(
  overrides: Partial<ConversionFixture> = {},
): ConversionFixture {
  const id = overrides.id ?? uuid("conv");
  return {
    id,
    organization_id: overrides.organization_id ?? uuid("org"),
    lead_id: overrides.lead_id ?? null,
    event_name: overrides.event_name ?? "Purchase",
    value: overrides.value ?? 100,
    currency: overrides.currency ?? "BRL",
    occurred_at: overrides.occurred_at ?? new Date().toISOString(),
    provider: overrides.provider ?? "meta",
    external_id: overrides.external_id ?? null,
  };
}
