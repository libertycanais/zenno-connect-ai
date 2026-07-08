// Adapter para a WhatsApp Business Cloud API (WABA) oficial da Meta.
// SERVER-ONLY. Importar apenas dentro do handler de um server route ou server fn:
//   const { sendWabaText } = await import("@/lib/whatsapp-waba.server");
//
// Fluxo esperado:
// - whatsapp_instances.provider = 'waba'
// - whatsapp_instances.token = permanent access token do System User
// - whatsapp_instances.waba_phone_id = phone_number_id do WABA
// - Webhook do WABA aponta pra /api/public/whatsapp/webhook/<instance_id>
//   e envia header x-hub-signature-256 (validar com app secret, futuro).

const GRAPH_URL = "https://graph.facebook.com/v20.0";

export type WabaInstance = {
  id: string;
  token: string;
  waba_phone_id: string | null;
  waba_business_id: string | null;
};

async function post(path: string, token: string, body: unknown) {
  const r = await fetch(`${GRAPH_URL}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`WABA ${r.status}: ${j?.error?.message ?? r.statusText}`);
  return j;
}

export async function sendWabaText(inst: WabaInstance, to: string, text: string) {
  if (!inst.waba_phone_id) throw new Error("Instância WABA sem waba_phone_id.");
  const clean = to.replace(/\D/g, "");
  return post(`${inst.waba_phone_id}/messages`, inst.token, {
    messaging_product: "whatsapp",
    to: clean,
    type: "text",
    text: { body: text.slice(0, 4096) },
  });
}

export async function sendWabaTemplate(
  inst: WabaInstance,
  to: string,
  templateName: string,
  languageCode: string,
  components?: unknown[],
) {
  if (!inst.waba_phone_id) throw new Error("Instância WABA sem waba_phone_id.");
  const clean = to.replace(/\D/g, "");
  return post(`${inst.waba_phone_id}/messages`, inst.token, {
    messaging_product: "whatsapp",
    to: clean,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components ? { components } : {}),
    },
  });
}

// Parser universal: dado o payload do webhook WABA, extrai lista normalizada de mensagens.
export function parseWabaWebhook(body: any) {
  const out: Array<{
    external_id: string | null;
    from: string;
    text: string | null;
    type: string;
    fromMe: boolean;
    pushName?: string | null;
    raw: unknown;
  }> = [];
  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const val = change?.value ?? {};
      const contacts = val.contacts ?? [];
      for (const msg of val.messages ?? []) {
        const type = msg.type ?? "text";
        out.push({
          external_id: msg.id ?? null,
          from: (msg.from ?? "").toString(),
          text:
            msg.text?.body ??
            msg.button?.text ??
            msg.interactive?.button_reply?.title ??
            msg.interactive?.list_reply?.title ??
            null,
          type,
          fromMe: false,
          pushName: contacts?.[0]?.profile?.name ?? null,
          raw: msg,
        });
      }
    }
  }
  return out;
}
