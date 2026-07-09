// Feature P0.3 — Payment Webhooks
// Tipos normalizados de eventos de webhook de pagamento, independentes de provider.
// A Provider Layer expõe apenas `NormalizedWebhookEvent`; nunca vaza SDK/objetos crus.

export type NormalizedWebhookEventType =
  | "checkout.completed"
  | "subscription.activated"
  | "subscription.updated"
  | "subscription.canceled"
  | "payment.succeeded"
  | "payment.failed"
  | "payment.refunded"
  | "unknown";

export type NormalizedWebhookEvent = {
  /** Nome do provider (stripe, mercadopago). */
  provider: string;
  /** Identificador único do evento no provider. Usado para idempotência. */
  eventId: string;
  /** Categoria normalizada do evento. */
  type: NormalizedWebhookEventType;
  /** Tipo original do provider, útil para debug. */
  rawType: string;
  /** Timestamp do evento no provider (ISO). */
  occurredAt: string;
  /** organization_id inferido do metadata / external_reference. */
  organizationId?: string;
  /** Código do plano (quando o evento carrega). */
  planCode?: string;
  /** ID da assinatura no provider (ex: sub_XXX). */
  subscriptionRef?: string;
  /** ID do customer no provider (ex: cus_XXX). */
  customerRef?: string;
  /** Fim do período corrente (ISO), quando aplicável. */
  currentPeriodEnd?: string;
  /** Cancelamento agendado para fim do período. */
  cancelAtPeriodEnd?: boolean;
  /** Valor em centavos, quando aplicável. */
  amountCents?: number;
  /** Moeda ISO (BRL, USD…). */
  currency?: string;
  /** Status do provider ("active", "past_due", "canceled"…). */
  providerStatus?: string;
};

/**
 * Erros de verificação/parse de webhook. Nunca vaza secret nem payload cru.
 */
export class WebhookVerificationError extends Error {
  constructor(
    public readonly provider: string,
    public readonly code:
      | "missing_signature"
      | "invalid_signature"
      | "expired"
      | "malformed_payload"
      | "unsupported",
    message: string,
  ) {
    super(`[${provider}:${code}] ${message}`);
    this.name = "WebhookVerificationError";
  }
}
