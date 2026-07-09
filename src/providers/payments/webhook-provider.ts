// Feature P0.3 — Extensão adaptada à Provider Layer.
// Wrapper que expõe verificação + normalização por provider, sem que rotas
// toquem SDK externo. Continua respeitando ADR: nada de SDK direto no consumer.

import type { PaymentProviderName } from "@/providers/payments/payment-provider.factory";
import type { NormalizedWebhookEvent } from "@/providers/payments/webhook-events.types";
import { WebhookVerificationError } from "@/providers/payments/webhook-events.types";
import {
  normalizeMPEvent,
  normalizeStripeEvent,
  verifyMPSignature,
  verifyStripeSignature,
} from "@/providers/payments/webhook-verifier";

export type WebhookVerifyInput = {
  rawBody: string;
  headers: Record<string, string>;
  secret: string;
  now?: () => number;
};

/**
 * Verifica assinatura e devolve evento normalizado. Nunca lança secret/payload.
 * Cada provider tem sua semântica isolada aqui.
 */
export async function verifyAndParsePaymentWebhook(
  provider: PaymentProviderName,
  input: WebhookVerifyInput,
): Promise<NormalizedWebhookEvent> {
  if (provider === "stripe") {
    const sig = input.headers["stripe-signature"] ?? input.headers["Stripe-Signature"];
    await verifyStripeSignature(input.rawBody, sig, input.secret, { now: input.now });
    let parsed: unknown;
    try {
      parsed = JSON.parse(input.rawBody);
    } catch {
      throw new WebhookVerificationError("stripe", "malformed_payload", "JSON inválido");
    }
    return normalizeStripeEvent(parsed);
  }

  if (provider === "mercadopago") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(input.rawBody);
    } catch {
      throw new WebhookVerificationError("mercadopago", "malformed_payload", "JSON inválido");
    }
    const dataId =
      (parsed && typeof parsed === "object" && (parsed as { data?: { id?: unknown } }).data?.id) ??
      (parsed && typeof parsed === "object" && (parsed as { id?: unknown }).id) ??
      null;
    await verifyMPSignature({
      signatureHeader: input.headers["x-signature"] ?? input.headers["X-Signature"],
      requestIdHeader: input.headers["x-request-id"] ?? input.headers["X-Request-Id"],
      dataId: dataId as string | number | null,
      secret: input.secret,
      now: input.now,
    });
    return normalizeMPEvent(parsed, input.headers);
  }

  throw new WebhookVerificationError(provider, "unsupported", "provider não suportado");
}
