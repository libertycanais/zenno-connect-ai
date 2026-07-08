import { uuid } from "@tests/helpers/id";

export type WebhookFixture = {
  id: string;
  organization_id: string;
  provider: "uazapi" | "meta" | "google_ads" | "stripe" | "mercadopago";
  event_type: string;
  signature: string | null;
  payload: Record<string, unknown>;
  received_at: string;
};

export function webhookFixture(overrides: Partial<WebhookFixture> = {}): WebhookFixture {
  const id = overrides.id ?? uuid("wh");
  return {
    id,
    organization_id: overrides.organization_id ?? uuid("org"),
    provider: overrides.provider ?? "uazapi",
    event_type: overrides.event_type ?? "message.received",
    signature: overrides.signature ?? "sha256=deadbeef",
    payload: overrides.payload ?? { hello: "world" },
    received_at: overrides.received_at ?? new Date().toISOString(),
  };
}

export function whatsappInboundPayloadFixture(instanceId: string = "inst_1"): {
  instanceId: string;
  event: string;
  fromMe: boolean;
  from: string;
  text: string;
  externalId: string;
  raw: Record<string, unknown>;
} {
  return {
    instanceId,
    event: "message",
    fromMe: false,
    from: "5511999990000",
    text: "hello from test",
    externalId: uuid("wa"),
    raw: { source: "uazapi-mock" },
  };
}
