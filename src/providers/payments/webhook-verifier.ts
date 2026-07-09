// Feature P0.3 — Verificação e normalização de webhooks (puros, testáveis).
// Zero I/O, zero dependência do bundler — usa apenas Web Crypto API.
// Consumido pelos adapters Stripe/MP e por testes unitários.

import {
  WebhookVerificationError,
  type NormalizedWebhookEvent,
  type NormalizedWebhookEventType,
} from "@/providers/payments/webhook-events.types";

// ---------------- HMAC helpers ----------------

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return bufToHex(new Uint8Array(sig));
}

function bufToHex(buf: Uint8Array): string {
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Comparação em tempo constante entre duas strings hex. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// ---------------- Stripe ----------------

/** Parseia header `Stripe-Signature: t=..,v1=..,v1=..`. */
export function parseStripeSignatureHeader(header: string | null | undefined): {
  timestamp: number;
  signatures: string[];
} {
  if (!header) {
    throw new WebhookVerificationError("stripe", "missing_signature", "Stripe-Signature ausente");
  }
  let t = 0;
  const sigs: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=");
    if (!k || !v) continue;
    if (k.trim() === "t") t = Number(v.trim());
    else if (k.trim() === "v1") sigs.push(v.trim());
  }
  if (!t || sigs.length === 0) {
    throw new WebhookVerificationError("stripe", "invalid_signature", "assinatura mal-formada");
  }
  return { timestamp: t, signatures: sigs };
}

export async function verifyStripeSignature(
  rawBody: string,
  header: string | null | undefined,
  secret: string,
  opts: { toleranceSeconds?: number; now?: () => number } = {},
): Promise<void> {
  if (!secret) {
    throw new WebhookVerificationError("stripe", "unsupported", "webhook secret não configurado");
  }
  const { timestamp, signatures } = parseStripeSignatureHeader(header);
  const tolerance = opts.toleranceSeconds ?? 5 * 60;
  const nowSec = Math.floor((opts.now?.() ?? Date.now()) / 1000);
  if (Math.abs(nowSec - timestamp) > tolerance) {
    throw new WebhookVerificationError("stripe", "expired", "timestamp fora da tolerância");
  }
  const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
  const ok = signatures.some((s) => timingSafeEqualHex(s, expected));
  if (!ok) throw new WebhookVerificationError("stripe", "invalid_signature", "hash divergente");
}

// ---------------- Mercado Pago ----------------

/** Parseia header `x-signature: ts=..,v1=..`. */
export function parseMPSignatureHeader(header: string | null | undefined): {
  ts: number;
  v1: string;
} {
  if (!header) {
    throw new WebhookVerificationError("mercadopago", "missing_signature", "x-signature ausente");
  }
  let ts = 0;
  let v1 = "";
  for (const part of header.split(",")) {
    const [k, v] = part.split("=");
    if (!k || !v) continue;
    if (k.trim() === "ts") ts = Number(v.trim());
    else if (k.trim() === "v1") v1 = v.trim();
  }
  if (!ts || !v1) {
    throw new WebhookVerificationError("mercadopago", "invalid_signature", "assinatura mal-formada");
  }
  return { ts, v1 };
}

/**
 * MP template canônico:
 *   `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 * Se `dataId` ou `requestId` ausentes, seus segmentos são omitidos (regra do MP).
 */
export function buildMPSignedPayload(input: {
  dataId?: string | number | null;
  requestId?: string | null;
  ts: number;
}): string {
  const parts: string[] = [];
  if (input.dataId != null && String(input.dataId).length > 0) {
    parts.push(`id:${input.dataId};`);
  }
  if (input.requestId) parts.push(`request-id:${input.requestId};`);
  parts.push(`ts:${input.ts};`);
  return parts.join("");
}

export async function verifyMPSignature(input: {
  signatureHeader: string | null | undefined;
  requestIdHeader: string | null | undefined;
  dataId: string | number | null | undefined;
  secret: string;
  toleranceSeconds?: number;
  now?: () => number;
}): Promise<void> {
  if (!input.secret) {
    throw new WebhookVerificationError("mercadopago", "unsupported", "webhook secret não configurado");
  }
  const { ts, v1 } = parseMPSignatureHeader(input.signatureHeader);
  const tolerance = input.toleranceSeconds ?? 10 * 60;
  const nowSec = Math.floor((input.now?.() ?? Date.now()) / 1000);
  // MP usa timestamp em milissegundos em alguns fluxos — normaliza.
  const tsSec = ts > 10_000_000_000 ? Math.floor(ts / 1000) : ts;
  if (Math.abs(nowSec - tsSec) > tolerance) {
    throw new WebhookVerificationError("mercadopago", "expired", "timestamp fora da tolerância");
  }
  const signed = buildMPSignedPayload({
    dataId: input.dataId ?? null,
    requestId: input.requestIdHeader ?? null,
    ts,
  });
  const expected = await hmacSha256Hex(input.secret, signed);
  if (!timingSafeEqualHex(v1, expected)) {
    throw new WebhookVerificationError("mercadopago", "invalid_signature", "hash divergente");
  }
}

// ---------------- Normalizers (parse → NormalizedWebhookEvent) ----------------

type StripeEvent = {
  id?: string;
  type?: string;
  created?: number;
  data?: { object?: Record<string, unknown> };
};

const STRIPE_TYPE_MAP: Record<string, NormalizedWebhookEventType> = {
  "checkout.session.completed": "checkout.completed",
  "customer.subscription.created": "subscription.activated",
  "customer.subscription.updated": "subscription.updated",
  "customer.subscription.deleted": "subscription.canceled",
  "invoice.paid": "payment.succeeded",
  "invoice.payment_succeeded": "payment.succeeded",
  "invoice.payment_failed": "payment.failed",
  "charge.refunded": "payment.refunded",
};

/** Converte um evento Stripe já JSON.parseado em `NormalizedWebhookEvent`. */
export function normalizeStripeEvent(ev: unknown): NormalizedWebhookEvent {
  if (!ev || typeof ev !== "object") {
    throw new WebhookVerificationError("stripe", "malformed_payload", "evento vazio");
  }
  const e = ev as StripeEvent;
  const rawType = String(e.type ?? "");
  const type = STRIPE_TYPE_MAP[rawType] ?? "unknown";
  const obj = (e.data?.object ?? {}) as Record<string, unknown>;
  const meta = (obj.metadata ?? {}) as Record<string, string>;

  const currentPeriodEnd =
    typeof obj.current_period_end === "number"
      ? new Date(obj.current_period_end * 1000).toISOString()
      : undefined;

  return {
    provider: "stripe",
    eventId: String(e.id ?? ""),
    rawType,
    type,
    occurredAt: e.created
      ? new Date(e.created * 1000).toISOString()
      : new Date().toISOString(),
    organizationId: meta.organization_id,
    planCode: meta.plan_code,
    subscriptionRef:
      typeof obj.subscription === "string"
        ? obj.subscription
        : typeof obj.id === "string" && rawType.startsWith("customer.subscription")
          ? obj.id
          : undefined,
    customerRef: typeof obj.customer === "string" ? obj.customer : undefined,
    currentPeriodEnd,
    cancelAtPeriodEnd:
      typeof obj.cancel_at_period_end === "boolean" ? obj.cancel_at_period_end : undefined,
    amountCents:
      typeof obj.amount_total === "number"
        ? obj.amount_total
        : typeof obj.amount_paid === "number"
          ? obj.amount_paid
          : typeof obj.amount === "number"
            ? obj.amount
            : undefined,
    currency: typeof obj.currency === "string" ? obj.currency.toUpperCase() : undefined,
    providerStatus: typeof obj.status === "string" ? obj.status : undefined,
  };
}

type MPPayload = {
  id?: string | number;
  type?: string;
  action?: string;
  date_created?: string;
  data?: { id?: string | number };
  external_reference?: string;
  metadata?: Record<string, string>;
};

const MP_ACTION_MAP: Record<string, NormalizedWebhookEventType> = {
  "payment.created": "payment.succeeded",
  "payment.updated": "payment.succeeded",
  "subscription.created": "subscription.activated",
  "subscription.updated": "subscription.updated",
  "subscription.cancelled": "subscription.canceled",
  "merchant_order.updated": "unknown",
};

/**
 * MP entrega apenas o id do recurso; a busca completa é feita depois.
 * Aqui normalizamos o envelope mínimo para idempotência + roteamento.
 */
export function normalizeMPEvent(payload: unknown, headers: Record<string, string> = {}): NormalizedWebhookEvent {
  if (!payload || typeof payload !== "object") {
    throw new WebhookVerificationError("mercadopago", "malformed_payload", "payload vazio");
  }
  const p = payload as MPPayload;
  const kind = p.type ?? "unknown";
  const action = p.action ?? "";
  const key = action || `${kind}.updated`;
  const type = MP_ACTION_MAP[key] ?? (action === "payment.refunded" ? "payment.refunded" : "unknown");
  const dataId = p.data?.id != null ? String(p.data.id) : p.id != null ? String(p.id) : "";
  const idempotencyId =
    headers["x-request-id"] ?? headers["x-idempotency-key"] ?? `${kind}:${action}:${dataId}`;

  return {
    provider: "mercadopago",
    eventId: idempotencyId,
    rawType: `${kind}.${action}`.replace(/\.+$/g, ""),
    type,
    occurredAt: p.date_created ?? new Date().toISOString(),
    organizationId: p.metadata?.organization_id ?? p.external_reference ?? undefined,
    planCode: p.metadata?.plan_code,
    subscriptionRef: kind === "subscription" ? dataId : undefined,
    customerRef: undefined,
    amountCents: undefined,
    currency: undefined,
    providerStatus: action || kind,
  };
}
