// Feature P0.3 — Mercado Pago payment webhook endpoint.
// Segurança idêntica ao endpoint Stripe: rate limit, HMAC, idempotência, audit.
import { createFileRoute } from "@tanstack/react-router";

import { clientIp, rateLimitHit, tooManyRequests } from "@/lib/rate-limit.server";
import { log, logContextFromRequest } from "@/lib/logger";
import { processPaymentWebhook } from "@/lib/webhooks.server";
import { verifyAndParsePaymentWebhook } from "@/providers/payments/webhook-provider";
import { WebhookVerificationError } from "@/providers/payments/webhook-events.types";

export const Route = createFileRoute("/api/public/webhooks/mercadopago")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = clientIp(request);
        const ctx = { ...logContextFromRequest(request), provider: "mercadopago", ip };

        const rl = await rateLimitHit(`webhook:mercadopago:${ip}`, 120, 60);
        if (rl.limited) return tooManyRequests(60);

        const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
        if (!secret) {
          log.error({ ...ctx, event: "webhook.secret_missing" });
          return new Response("Webhook not configured", { status: 503 });
        }

        const rawBody = await request.text();
        const headers = headersToRecord(request.headers);

        let event;
        try {
          event = await verifyAndParsePaymentWebhook("mercadopago", {
            rawBody,
            headers,
            secret,
          });
        } catch (e) {
          const code = e instanceof WebhookVerificationError ? e.code : "invalid_signature";
          log.warn({ ...ctx, event: "webhook.verify_failed", code });
          return new Response("Invalid signature", { status: 401 });
        }

        log.info({ ...ctx, event: "webhook.received", event_id: event.eventId, event_type: event.rawType });

        try {
          const parsedForPersistence = safeJsonParse(rawBody);
          const result = await processPaymentWebhook(event, parsedForPersistence, ctx);
          return new Response(JSON.stringify({ ok: true, status: result.status }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        } catch (e) {
          log.error({ ...ctx, event: "webhook.handler_failed", message: e instanceof Error ? e.message : String(e) });
          return new Response("Internal error", { status: 500 });
        }
      },
    },
  },
});

function headersToRecord(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  h.forEach((v, k) => { out[k.toLowerCase()] = v; });
  return out;
}

function safeJsonParse(raw: string): unknown {
  try { return JSON.parse(raw); } catch { return { raw: "[unparseable]" }; }
}
