import { describe, expect, it } from "vitest";
import {
  buildMPSignedPayload,
  normalizeMPEvent,
  normalizeStripeEvent,
  parseMPSignatureHeader,
  parseStripeSignatureHeader,
  timingSafeEqualHex,
  verifyMPSignature,
  verifyStripeSignature,
} from "@/providers/payments/webhook-verifier";
import { verifyAndParsePaymentWebhook } from "@/providers/payments/webhook-provider";
import { WebhookVerificationError } from "@/providers/payments/webhook-events.types";
import {
  deriveSubscriptionPatch,
  sanitizeWebhookPayload,
} from "@/lib/webhooks.server";

const SECRET = "whsec_test_dummy";
const NOW = new Date("2026-07-09T12:00:00Z").getTime();

async function hmacHex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("webhook-verifier — Stripe signature", () => {
  it("timingSafeEqualHex compara em tempo constante", () => {
    expect(timingSafeEqualHex("abcd", "abcd")).toBe(true);
    expect(timingSafeEqualHex("abcd", "abce")).toBe(false);
    expect(timingSafeEqualHex("ab", "abcd")).toBe(false);
  });

  it("parseStripeSignatureHeader extrai t e v1", () => {
    const { timestamp, signatures } = parseStripeSignatureHeader(
      "t=1720526400,v1=aaaa,v1=bbbb",
    );
    expect(timestamp).toBe(1720526400);
    expect(signatures).toEqual(["aaaa", "bbbb"]);
  });

  it("parseStripeSignatureHeader falha sem header", () => {
    expect(() => parseStripeSignatureHeader(null)).toThrow(WebhookVerificationError);
  });

  it("verifica assinatura Stripe válida", async () => {
    const ts = Math.floor(NOW / 1000);
    const body = JSON.stringify({ id: "evt_1", type: "invoice.paid" });
    const sig = await hmacHex(SECRET, `${ts}.${body}`);
    await expect(
      verifyStripeSignature(body, `t=${ts},v1=${sig}`, SECRET, { now: () => NOW }),
    ).resolves.toBeUndefined();
  });

  it("rejeita assinatura Stripe inválida", async () => {
    const ts = Math.floor(NOW / 1000);
    const body = JSON.stringify({ id: "evt_2" });
    await expect(
      verifyStripeSignature(body, `t=${ts},v1=deadbeef`, SECRET, { now: () => NOW }),
    ).rejects.toBeInstanceOf(WebhookVerificationError);
  });

  it("rejeita replay (timestamp expirado)", async () => {
    const ts = Math.floor(NOW / 1000) - 3600; // 1h atrás
    const body = JSON.stringify({ id: "evt_3" });
    const sig = await hmacHex(SECRET, `${ts}.${body}`);
    await expect(
      verifyStripeSignature(body, `t=${ts},v1=${sig}`, SECRET, {
        toleranceSeconds: 300,
        now: () => NOW,
      }),
    ).rejects.toMatchObject({ code: "expired" });
  });
});

describe("webhook-verifier — Mercado Pago signature", () => {
  it("parseMPSignatureHeader extrai ts e v1", () => {
    const { ts, v1 } = parseMPSignatureHeader("ts=1720526400,v1=abc");
    expect(ts).toBe(1720526400);
    expect(v1).toBe("abc");
  });

  it("buildMPSignedPayload monta template canônico", () => {
    expect(
      buildMPSignedPayload({ dataId: "123", requestId: "req-1", ts: 42 }),
    ).toBe("id:123;request-id:req-1;ts:42;");
    expect(buildMPSignedPayload({ dataId: null, requestId: null, ts: 42 })).toBe("ts:42;");
  });

  it("verifica assinatura MP válida", async () => {
    const ts = Math.floor(NOW / 1000);
    const dataId = "9999";
    const requestId = "req-abc";
    const signed = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const v1 = await hmacHex(SECRET, signed);
    await expect(
      verifyMPSignature({
        signatureHeader: `ts=${ts},v1=${v1}`,
        requestIdHeader: requestId,
        dataId,
        secret: SECRET,
        now: () => NOW,
      }),
    ).resolves.toBeUndefined();
  });

  it("rejeita MP com hash divergente", async () => {
    const ts = Math.floor(NOW / 1000);
    await expect(
      verifyMPSignature({
        signatureHeader: `ts=${ts},v1=cafebabe`,
        requestIdHeader: "r",
        dataId: "1",
        secret: SECRET,
        now: () => NOW,
      }),
    ).rejects.toBeInstanceOf(WebhookVerificationError);
  });
});

describe("normalizeStripeEvent", () => {
  it("checkout.session.completed extrai organization_id do metadata", () => {
    const ev = normalizeStripeEvent({
      id: "evt_10",
      type: "checkout.session.completed",
      created: 1720526400,
      data: {
        object: {
          id: "cs_1",
          subscription: "sub_100",
          customer: "cus_100",
          metadata: { organization_id: "org-1", plan_code: "basico" },
          amount_total: 2999,
          currency: "brl",
        },
      },
    });
    expect(ev.type).toBe("checkout.completed");
    expect(ev.organizationId).toBe("org-1");
    expect(ev.planCode).toBe("basico");
    expect(ev.subscriptionRef).toBe("sub_100");
    expect(ev.customerRef).toBe("cus_100");
    expect(ev.amountCents).toBe(2999);
    expect(ev.currency).toBe("BRL");
  });

  it("customer.subscription.deleted → subscription.canceled", () => {
    const ev = normalizeStripeEvent({
      id: "evt_11",
      type: "customer.subscription.deleted",
      created: 1720526400,
      data: { object: { id: "sub_200", customer: "cus_200", status: "canceled" } },
    });
    expect(ev.type).toBe("subscription.canceled");
    expect(ev.subscriptionRef).toBe("sub_200");
  });

  it("invoice.payment_failed → payment.failed", () => {
    const ev = normalizeStripeEvent({
      id: "evt_12",
      type: "invoice.payment_failed",
      created: 1720526400,
      data: { object: { subscription: "sub_300", amount_paid: 0 } },
    });
    expect(ev.type).toBe("payment.failed");
    expect(ev.subscriptionRef).toBe("sub_300");
  });

  it("charge.refunded → payment.refunded", () => {
    const ev = normalizeStripeEvent({
      id: "evt_13",
      type: "charge.refunded",
      created: 1720526400,
      data: { object: { customer: "cus_r", amount: 1000, currency: "usd" } },
    });
    expect(ev.type).toBe("payment.refunded");
    expect(ev.currency).toBe("USD");
  });

  it("tipo desconhecido → unknown", () => {
    const ev = normalizeStripeEvent({ id: "evt_14", type: "foo.bar", created: 1, data: { object: {} } });
    expect(ev.type).toBe("unknown");
  });
});

describe("normalizeMPEvent", () => {
  it("payment.updated → payment.succeeded", () => {
    const ev = normalizeMPEvent(
      {
        id: "1",
        type: "payment",
        action: "payment.updated",
        date_created: "2026-07-09T12:00:00Z",
        data: { id: "12345" },
        external_reference: "org-abc",
      },
      { "x-request-id": "req-xyz" },
    );
    expect(ev.type).toBe("payment.succeeded");
    expect(ev.eventId).toBe("req-xyz");
    expect(ev.organizationId).toBe("org-abc");
  });

  it("subscription.updated → subscription.updated", () => {
    const ev = normalizeMPEvent({
      type: "subscription",
      action: "subscription.updated",
      data: { id: "sub-99" },
      metadata: { organization_id: "org-9", plan_code: "completo" },
    });
    expect(ev.type).toBe("subscription.updated");
    expect(ev.subscriptionRef).toBe("sub-99");
    expect(ev.planCode).toBe("completo");
    expect(ev.organizationId).toBe("org-9");
  });
});

describe("verifyAndParsePaymentWebhook — end-to-end signature", () => {
  it("Stripe: verifica + normaliza", async () => {
    const ts = Math.floor(NOW / 1000);
    const body = JSON.stringify({
      id: "evt_e2e",
      type: "invoice.paid",
      created: ts,
      data: { object: { subscription: "sub_e2e", amount_paid: 5000, currency: "brl" } },
    });
    const sig = await hmacHex(SECRET, `${ts}.${body}`);
    const ev = await verifyAndParsePaymentWebhook("stripe", {
      rawBody: body,
      headers: { "stripe-signature": `t=${ts},v1=${sig}` },
      secret: SECRET,
      now: () => NOW,
    });
    expect(ev.type).toBe("payment.succeeded");
    expect(ev.eventId).toBe("evt_e2e");
  });

  it("Stripe: assinatura errada rejeita", async () => {
    const ts = Math.floor(NOW / 1000);
    await expect(
      verifyAndParsePaymentWebhook("stripe", {
        rawBody: "{}",
        headers: { "stripe-signature": `t=${ts},v1=deadbeef` },
        secret: SECRET,
        now: () => NOW,
      }),
    ).rejects.toBeInstanceOf(WebhookVerificationError);
  });
});

describe("deriveSubscriptionPatch", () => {
  const base = {
    provider: "stripe",
    eventId: "e",
    rawType: "x",
    occurredAt: "2026-07-09T12:00:00Z",
  };

  it("checkout.completed produz patch active + provider_subscription_id", () => {
    const { patch, eventType } = deriveSubscriptionPatch({
      ...base,
      type: "checkout.completed",
      subscriptionRef: "sub_1",
      customerRef: "cus_1",
      planCode: "basico",
      currentPeriodEnd: "2026-08-09T12:00:00Z",
    });
    expect(eventType).toBe("activated");
    expect(patch?.status).toBe("active");
    expect(patch?.provider_subscription_id).toBe("sub_1");
    expect(patch?.plan).toBe("basico");
    expect(patch?.cancel_at_period_end).toBe(false);
  });

  it("subscription.canceled produz cancelled + canceled_at", () => {
    const { patch, eventType } = deriveSubscriptionPatch({ ...base, type: "subscription.canceled" });
    expect(eventType).toBe("canceled");
    expect(patch?.status).toBe("cancelled");
    expect(patch?.canceled_at).toBe(base.occurredAt);
  });

  it("payment.failed → past_due", () => {
    const { patch, eventType } = deriveSubscriptionPatch({ ...base, type: "payment.failed" });
    expect(eventType).toBe("payment_failed");
    expect(patch?.status).toBe("past_due");
  });

  it("payment.refunded emite evento sem alterar status", () => {
    const { patch, eventType } = deriveSubscriptionPatch({ ...base, type: "payment.refunded" });
    expect(eventType).toBe("payment_refunded");
    expect(patch).not.toBeNull();
  });

  it("unknown → patch null", () => {
    const { patch } = deriveSubscriptionPatch({ ...base, type: "unknown", rawType: "foo.bar" });
    expect(patch).toBeNull();
  });
});

describe("sanitizeWebhookPayload", () => {
  it("redige chaves sensíveis em profundidade", () => {
    const cleaned = sanitizeWebhookPayload({
      id: "evt",
      client_secret: "sk_live_xxx",
      data: {
        object: {
          api_key: "shhh",
          nested: { authorization: "Bearer abc", ok: 1 },
        },
      },
    }) as Record<string, any>;
    expect(cleaned.client_secret).toBe("[REDACTED]");
    expect(cleaned.data.object.api_key).toBe("[REDACTED]");
    expect(cleaned.data.object.nested.authorization).toBe("[REDACTED]");
    expect(cleaned.data.object.nested.ok).toBe(1);
  });
});
