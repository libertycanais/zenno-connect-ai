// Uazapi adapter — encapsula chamadas ao gateway Uazapi.
// A lógica de leitura/escrita no banco continua nos consumers de domínio;
// este provider apenas fala com a API externa.
import {
  ProviderError,
  ProviderNotConfiguredError,
  type ProviderContext,
} from "@/providers/common/provider.types";
import type {
  WhatsAppInboundEvent,
  WhatsAppInstanceRef,
  WhatsAppOutboundMessage,
  WhatsAppProvider,
} from "@/providers/whatsapp/whatsapp-provider.interface";

function baseUrl() {
  const url = process.env.UAZAPI_BASE_URL;
  if (!url) throw new ProviderNotConfiguredError("uazapi", ["UAZAPI_BASE_URL"]);
  return url.replace(/\/$/, "");
}

function apiToken() {
  const t = process.env.UAZAPI_API_TOKEN;
  if (!t) throw new ProviderNotConfiguredError("uazapi", ["UAZAPI_API_TOKEN"]);
  return t;
}

export class UazapiProvider implements WhatsAppProvider {
  readonly name = "uazapi";

  async createInstance(_ctx: ProviderContext, input: { name: string }): Promise<WhatsAppInstanceRef> {
    const res = await fetch(`${baseUrl()}/instance/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "AdminToken": apiToken() },
      body: JSON.stringify({ name: input.name }),
    });
    if (!res.ok) throw new ProviderError("uazapi", "create_failed", (await res.text()).slice(0, 200));
    const json = await res.json() as { instance?: { id?: string; token?: string; status?: string } };
    return {
      id: json.instance?.id ?? "",
      status: (json.instance?.status as WhatsAppInstanceRef["status"]) ?? "pending",
    };
  }

  async getInstanceStatus(_ctx: ProviderContext, instanceId: string): Promise<WhatsAppInstanceRef> {
    const res = await fetch(`${baseUrl()}/instance/status?id=${encodeURIComponent(instanceId)}`, {
      headers: { "AdminToken": apiToken() },
    });
    if (!res.ok) return { id: instanceId, status: "unknown" };
    const json = await res.json() as { connected?: boolean; phone?: string };
    return {
      id: instanceId,
      status: json.connected ? "connected" : "disconnected",
      phoneNumber: json.phone ?? null,
    };
  }

  async sendMessage(
    _ctx: ProviderContext, instanceId: string, msg: WhatsAppOutboundMessage,
  ): Promise<{ ok: boolean; externalId?: string }> {
    const res = await fetch(`${baseUrl()}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Token": instanceId },
      body: JSON.stringify({ number: msg.to, text: msg.text ?? msg.caption ?? "" }),
    });
    if (!res.ok) throw new ProviderError("uazapi", "send_failed", (await res.text()).slice(0, 200));
    const json = await res.json() as { id?: string };
    return { ok: true, externalId: json.id };
  }

  async receiveWebhook(
    _ctx: ProviderContext, instanceId: string, payload: unknown,
  ): Promise<WhatsAppInboundEvent> {
    const p = (payload ?? {}) as Record<string, unknown>;
    const eventRaw = String(p.event ?? p.type ?? "message");
    let event: WhatsAppInboundEvent["event"] = "other";
    if (eventRaw.includes("connection") || eventRaw.includes("status")) event = eventRaw.includes("status") ? "status" : "connection";
    else if (eventRaw.includes("message")) event = "message";
    const data = ((p.data ?? p.message ?? p) as Record<string, unknown>) || {};
    const key = (data.key as Record<string, unknown> | undefined) ?? {};
    return {
      instanceId,
      event,
      fromMe: Boolean(data.fromMe ?? key.fromMe),
      from: (data.from ?? (key.remoteJid as string | undefined) ?? (data.phone as string | undefined)) as string | undefined,
      externalId: (data.id ?? (key.id as string | undefined) ?? null) as string | null,
      text: (data.text ?? data.body ?? ((data.message as { conversation?: string } | undefined)?.conversation) ?? null) as string | null,
      raw: payload,
    };
  }

  async disconnectInstance(_ctx: ProviderContext, instanceId: string): Promise<void> {
    try {
      await fetch(`${baseUrl()}/instance/disconnect?id=${encodeURIComponent(instanceId)}`, {
        method: "POST", headers: { "AdminToken": apiToken() },
      });
    } catch {
      /* best-effort */
    }
  }
}
