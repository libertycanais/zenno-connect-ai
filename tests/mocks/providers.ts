/**
 * Mocks tipados dos Providers (Ads, WhatsApp, Payments, AI).
 * Respeitam as interfaces canônicas — trocar impl sem quebrar consumers.
 */
import { vi } from "vitest";
import type {
  AdsProvider,
  AdsAccountRef,
  AdsCampaign,
  AdsInsight,
} from "@/providers/ads/ads-provider.interface";
import type {
  WhatsAppProvider,
  WhatsAppInstanceRef,
  WhatsAppInboundEvent,
} from "@/providers/whatsapp/whatsapp-provider.interface";
import type {
  PaymentProvider,
  PaymentCustomer,
  PaymentSubscription,
  PaymentCheckoutSession,
  PaymentStatus,
} from "@/providers/payments/payment-provider.interface";
import type {
  AIProvider,
  AIChatResult,
  AIEmbeddingResult,
} from "@/providers/ai/ai-provider.interface";

export function createAdsProviderMock(overrides: Partial<AdsProvider> = {}): AdsProvider {
  return {
    name: "mock-ads",
    connectAccount: vi.fn(async (): Promise<AdsAccountRef[]> => []),
    getCampaigns: vi.fn(async (): Promise<AdsCampaign[]> => []),
    getInsights: vi.fn(async (): Promise<AdsInsight[]> => []),
    sendConversion: vi.fn(async () => ({ ok: true, externalId: "mock-conv-1" })),
    disconnectAccount: vi.fn(async () => undefined),
    ...overrides,
  };
}

export function createWhatsAppProviderMock(
  overrides: Partial<WhatsAppProvider> = {},
): WhatsAppProvider {
  const defaultInstance: WhatsAppInstanceRef = {
    id: "mock-instance",
    status: "connected",
    phoneNumber: "+5511999990000",
  };
  return {
    name: "mock-whatsapp",
    createInstance: vi.fn(async () => defaultInstance),
    getInstanceStatus: vi.fn(async () => defaultInstance),
    sendMessage: vi.fn(async () => ({ ok: true, externalId: "mock-msg-1" })),
    receiveWebhook: vi.fn(
      async (_ctx, instanceId, payload): Promise<WhatsAppInboundEvent> => ({
        instanceId,
        event: "message",
        fromMe: false,
        from: "5511999990000",
        externalId: "mock-inbound-1",
        text: "hello",
        raw: payload,
      }),
    ),
    disconnectInstance: vi.fn(async () => undefined),
    ...overrides,
  };
}

export function createPaymentProviderMock(
  overrides: Partial<PaymentProvider> = {},
): PaymentProvider {
  return {
    name: "mock-payments",
    createCustomer: vi.fn(
      async (_ctx, input): Promise<PaymentCustomer> => ({
        id: "cus_mock",
        email: input.email,
        name: input.name,
      }),
    ),
    createSubscription: vi.fn(
      async (): Promise<PaymentSubscription> => ({
        id: "sub_mock",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      }),
    ),
    cancelSubscription: vi.fn(
      async (_ctx, id): Promise<PaymentSubscription> => ({
        id,
        status: "canceled",
      }),
    ),
    getPaymentStatus: vi.fn(
      async (): Promise<PaymentStatus> => ({
        status: "paid",
        amount: 1000,
        currency: "BRL",
      }),
    ),
    createCheckout: vi.fn(
      async (): Promise<PaymentCheckoutSession> => ({
        id: "cs_mock",
        url: "https://mock.example.com/checkout/cs_mock",
      }),
    ),
    ...overrides,
  };
}

export function createAIProviderMock(overrides: Partial<AIProvider> = {}): AIProvider {
  return {
    name: "mock-ai",
    chat: vi.fn(
      async (): Promise<AIChatResult> => ({
        content: "mock response",
        usage: { promptTokens: 10, completionTokens: 5 },
      }),
    ),
    vision: vi.fn(async (): Promise<AIChatResult> => ({ content: "mock vision" })),
    embeddings: vi.fn(
      async (): Promise<AIEmbeddingResult> => ({
        vectors: [[0.1, 0.2, 0.3]],
        model: "mock-embed",
      }),
    ),
    executeAction: vi.fn(async () => ({ ok: true, result: null })),
    ...overrides,
  };
}
