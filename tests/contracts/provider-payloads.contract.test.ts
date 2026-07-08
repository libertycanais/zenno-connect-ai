/**
 * WS-8 — Provider Payload Snapshots
 *
 * Congela o formato dos payloads que a Provider Layer envia para
 * Meta Conversion API, Google Ads Offline Conversion Import e WhatsApp
 * (Uazapi). Interceptamos `fetch` global e capturamos o body JSON emitido.
 *
 * Estas assinaturas afetam integrações externas — não podem regredir sem
 * atualização coordenada de configuração server-side.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MetaAdsProvider } from "@/providers/ads/meta-ads.provider";
import { GoogleAdsProvider } from "@/providers/ads/google-ads.provider";
import { UazapiWhatsAppProvider } from "@/providers/whatsapp/uazapi.provider";
import type { AdsAccountConnection, AdsConversionEvent } from "@/providers/ads/ads-provider.interface";
import type { ProviderContext } from "@/providers/common/provider.types";

type Captured = { url: string; init?: RequestInit };
const captured: Captured[] = [];

function stubFetch(response: unknown = { events_received: 1, fbtrace_id: "trace_1" }) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    captured.push({ url: String(input), init });
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fn);
}

function parseBody(init?: RequestInit): unknown {
  if (!init?.body) return null;
  try {
    return JSON.parse(String(init.body));
  } catch {
    return String(init.body);
  }
}

const ctx: ProviderContext = { organizationId: "org-1", userId: "u-1" };
const conn: AdsAccountConnection = {
  accessToken: "tk_live_meta",
  externalAccountId: "act_123",
};

beforeEach(() => {
  captured.length = 0;
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.META_PIXEL_ID;
  delete process.env.GOOGLE_ADS_CONVERSION_ACTION_ID;
  delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  delete process.env.UAZAPI_BASE_URL;
  delete process.env.UAZAPI_ADMIN_TOKEN;
});

describe("Contract: Meta Conversion API payload", () => {
  it("body shape is frozen (data[0].{event_name,event_time,action_source,user_data,custom_data})", async () => {
    process.env.META_PIXEL_ID = "PIX_123";
    stubFetch({ events_received: 1, fbtrace_id: "trace_x" });
    const provider = new MetaAdsProvider();
    const event: AdsConversionEvent = {
      eventName: "Purchase",
      eventTime: 1_700_000_000,
      value: 199.9,
      currency: "BRL",
      userData: { em: "hashed_email" },
      customData: { order_id: "o_1" },
    };
    const out = await provider.sendConversion(ctx, conn, event);
    expect(out.ok).toBe(true);

    const [call] = captured;
    expect(call.url).toContain("/PIX_123/events");
    expect(call.url).toContain("access_token=tk_live_meta");
    expect(call.init?.method).toBe("POST");
    expect((call.init?.headers as Record<string, string>)["Content-Type"]).toBe("application/json");

    expect(parseBody(call.init)).toMatchInlineSnapshot(`
      {
        "data": [
          {
            "action_source": "website",
            "custom_data": {
              "currency": "BRL",
              "order_id": "o_1",
              "value": 199.9,
            },
            "event_name": "Purchase",
            "event_time": 1700000000,
            "user_data": {
              "em": "hashed_email",
            },
          },
        ],
      }
    `);
  });
});

describe("Contract: Google Ads Offline Conversion Import payload", () => {
  it("body shape is frozen (conversions[0].{conversionAction,conversionDateTime,conversionValue,currencyCode})", async () => {
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "dev_tok";
    process.env.GOOGLE_ADS_CONVERSION_ACTION_ID = "CA_1";
    process.env.GOOGLE_ADS_CLIENT_ID = "gc_id";
    process.env.GOOGLE_ADS_CLIENT_SECRET = "gc_secret";
    stubFetch({});
    const provider = new GoogleAdsProvider();
    const gconn: AdsAccountConnection = {
      accessToken: "ya29_google",
      externalAccountId: "1234567890",
    };
    const event: AdsConversionEvent = {
      eventName: "purchase",
      eventTime: 1_700_000_000,
      value: 250,
      currency: "USD",
    };
    await provider.sendConversion(ctx, gconn, event);

    const [call] = captured;
    expect(call.url).toContain("/customers/1234567890:uploadClickConversions");
    expect((call.init?.headers as Record<string, string>).Authorization).toBe("Bearer ya29_google");
    expect((call.init?.headers as Record<string, string>)["developer-token"]).toBe("dev_tok");

    const body = parseBody(call.init) as {
      conversions: Array<Record<string, unknown>>;
      partialFailure: boolean;
    };
    expect(Object.keys(body).sort()).toEqual(["conversions", "partialFailure"]);
    expect(body.partialFailure).toBe(true);
    expect(Object.keys(body.conversions[0]).sort()).toEqual([
      "conversionAction",
      "conversionDateTime",
      "conversionValue",
      "currencyCode",
    ]);
    expect(body.conversions[0].conversionAction).toBe(
      "customers/1234567890/conversionActions/CA_1",
    );
    expect(body.conversions[0].conversionValue).toBe(250);
    expect(body.conversions[0].currencyCode).toBe("USD");
    // conversionDateTime format: "YYYY-MM-DD HH:MM:SS+00:00"
    expect(body.conversions[0].conversionDateTime).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\+00:00$/,
    );
  });
});

describe("Contract: WhatsApp (Uazapi) send payload", () => {
  it("body shape is frozen ({ number, text })", async () => {
    process.env.UAZAPI_BASE_URL = "https://uazapi.test";
    process.env.UAZAPI_ADMIN_TOKEN = "admin_tok";
    stubFetch({ id: "wamid_1" });
    const provider = new UazapiWhatsAppProvider();
    const out = await provider.sendMessage(ctx, "inst-1", {
      to: "5511999999999",
      text: "Olá",
    });
    expect(out.ok).toBe(true);
    expect(out.externalId).toBe("wamid_1");

    const [call] = captured;
    expect(call.url).toBe("https://uazapi.test/send/text");
    expect((call.init?.headers as Record<string, string>).Token).toBe("inst-1");
    expect(parseBody(call.init)).toMatchInlineSnapshot(`
      {
        "number": "5511999999999",
        "text": "Olá",
      }
    `);
  });

  it("inbound webhook normalization shape is frozen", async () => {
    const provider = new UazapiWhatsAppProvider();
    const result = await provider.receiveWebhook(ctx, "inst-1", {
      event: "message",
      data: {
        from: "5511999999999@s.whatsapp.net",
        id: "wamid_2",
        fromMe: false,
        text: "hi",
      },
    });
    expect(Object.keys(result).sort()).toEqual([
      "event",
      "externalId",
      "from",
      "fromMe",
      "instanceId",
      "raw",
      "text",
    ]);
    expect(result.event).toBe("message");
    expect(result.externalId).toBe("wamid_2");
  });
});
