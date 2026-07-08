import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { clientIp, rateLimitHit, tooManyRequests } from "@/lib/rate-limit.server";

// Webhook receiver for WhatsApp/Uazapi.
// Configure your Uazapi instance webhook to POST to:
//   https://<your-app>/api/public/whatsapp/webhook/<instance_id>
// with header  x-webhook-secret: <webhook_secret>
// The secret comes from whatsapp_instances.webhook_secret and is rotated per row.

export const Route = createFileRoute("/api/public/whatsapp/webhook/$instanceId")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const secret = request.headers.get("x-webhook-secret");
        const instanceId = params.instanceId;
        const ip = clientIp(request);

        const [instHit, ipHit] = await Promise.all([
          rateLimitHit(`webhook:${instanceId ?? "unknown"}`, 600, 60),
          rateLimitHit(`webhook:${ip}`, 300, 60),
        ]);
        if (instHit.limited || ipHit.limited) return tooManyRequests(60);

        if (!instanceId || !secret) {
          return new Response("Missing instance or secret header", { status: 401 });
        }

        const { data: inst, error: ierr } = await supabaseAdmin
          .from("whatsapp_instances")
          .select("id, organization_id, webhook_secret")
          .eq("id", instanceId)
          .single();
        if (ierr || !inst || inst.webhook_secret !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: any;
        try { body = await request.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

        const event = body?.event ?? body?.type ?? "message";
        const payload = body?.data ?? body?.message ?? body;

        if (event.toString().includes("connection") || event.toString().includes("status")) {
          const connected = Boolean(payload?.connected ?? payload?.status === "connected");
          await supabaseAdmin
            .from("whatsapp_instances")
            .update({
              status: connected ? "connected" : "disconnected",
              phone_number: payload?.phone ?? payload?.wid ?? null,
              last_sync_at: new Date().toISOString(),
            })
            .eq("id", inst.id);
          return new Response("ok");
        }

        // Message event
        const phone: string | undefined = payload?.from ?? payload?.chat?.id ?? payload?.key?.remoteJid ?? payload?.phone;
        if (!phone) return new Response("ok");
        const cleanPhone = phone.toString().replace(/@.*$/, "");
        const externalId = payload?.id ?? payload?.key?.id ?? null;
        const fromMe = Boolean(payload?.fromMe ?? payload?.key?.fromMe);
        const text: string | null = payload?.text ?? payload?.body ?? payload?.message?.conversation ?? null;
        const msgType = (payload?.type ?? payload?.messageType ?? "text") as string;

        const { data: chat } = await supabaseAdmin
          .from("whatsapp_chats")
          .upsert(
            {
              organization_id: inst.organization_id,
              instance_id: inst.id,
              phone: cleanPhone,
              name: payload?.pushName ?? payload?.sender?.name ?? null,
              last_message_at: new Date().toISOString(),
              last_message_preview: text?.slice(0, 200) ?? `[${msgType}]`,
            },
            { onConflict: "instance_id,phone" },
          )
          .select("id")
          .single();

        if (chat) {
          if (!fromMe) {
            const { data: cur } = await supabaseAdmin.from("whatsapp_chats").select("unread_count").eq("id", chat.id).single();
            await supabaseAdmin
              .from("whatsapp_chats")
              .update({ unread_count: (cur?.unread_count ?? 0) + 1 })
              .eq("id", chat.id);
          }
          await supabaseAdmin.from("whatsapp_messages").upsert(
            {
              organization_id: inst.organization_id,
              instance_id: inst.id,
              chat_id: chat.id,
              external_id: externalId,
              direction: fromMe ? "out" : "in",
              message_type: (["text","image","audio","video","document","sticker","location","contact"].includes(msgType) ? msgType : "other") as any,
              content: text,
              status: fromMe ? "sent" : "delivered",
              metadata: payload,
            },
            { onConflict: "instance_id,external_id", ignoreDuplicates: true },
          );
          if (!fromMe) {
            // === Atribuição: casa código [t:XXXXXX] da 1a mensagem com o clique do anúncio ===
            try { await attributeWhatsappChat(inst.organization_id, chat.id, cleanPhone, text); }
            catch (e) { console.error("wa attribution", e); }

            const { dispatchEvent } = await import("@/lib/automations.functions");
            dispatchEvent({
              organizationId: inst.organization_id,
              triggerType: "whatsapp.message_received",
              payload: { chat_id: chat.id, phone, text, message_type: msgType },
            }).catch((e) => console.error("dispatch wa msg", e));
          }
        }
        return new Response("ok");
      },
    },
  },
});

async function attributeWhatsappChat(
  orgId: string,
  chatId: string,
  cleanPhone: string,
  text: string | null,
) {
  // Já atribuído? sai.
  const { data: chatRow } = await supabaseAdmin
    .from("whatsapp_chats")
    .select("attributed_at, tracking_session_id")
    .eq("id", chatId)
    .maybeSingle();
  if (chatRow?.attributed_at || chatRow?.tracking_session_id) return;

  if (!text) return;
  const m = text.match(/\[t:([A-Z2-9]{4,10})\]/i);
  if (!m) return;
  const code = m[1].toUpperCase();

  const { data: codeRow } = await supabaseAdmin
    .from("whatsapp_tracking_codes")
    .select("session_id, organization_id, consumed_at, expires_at")
    .eq("code", code)
    .maybeSingle();
  if (!codeRow || codeRow.organization_id !== orgId) return;
  if (codeRow.consumed_at) return;
  if (new Date(codeRow.expires_at) < new Date()) return;

  const { data: lead } = await supabaseAdmin
    .from("tracking_leads")
    .select("id, first_fbclid, first_gclid, first_utm_source, first_utm_campaign, first_utm_content, first_utm_term, first_landing_url, email")
    .eq("organization_id", orgId)
    .eq("session_id", codeRow.session_id)
    .maybeSingle();

  const nowIso = new Date().toISOString();
  await supabaseAdmin.from("whatsapp_chats").update({
    tracking_session_id: codeRow.session_id,
    tracking_short_code: code,
    tracking_lead_id: lead?.id ?? null,
    first_fbclid: lead?.first_fbclid ?? null,
    first_gclid: lead?.first_gclid ?? null,
    first_utm_source: lead?.first_utm_source ?? null,
    first_utm_campaign: lead?.first_utm_campaign ?? null,
    first_utm_content: lead?.first_utm_content ?? null,
    first_utm_term: lead?.first_utm_term ?? null,
    first_landing_url: lead?.first_landing_url ?? null,
    attributed_at: nowIso,
  }).eq("id", chatId);

  await supabaseAdmin.from("whatsapp_tracking_codes")
    .update({ consumed_at: nowIso }).eq("code", code);

  // Dispara Lead na Meta CAPI usando action_source="business_messaging"
  try {
    const { dispatchMetaCapi, registerGoogleOfflineConversion } = await import("@/lib/attribution.server");
    await dispatchMetaCapi({
      organizationId: orgId,
      eventName: "Lead",
      actionSource: "business_messaging",
      fbclid: lead?.first_fbclid ?? null,
      email: lead?.email ?? null,
      phone: cleanPhone,
      externalId: codeRow.session_id,
      eventSourceUrl: lead?.first_landing_url ?? null,
    });
    await registerGoogleOfflineConversion({
      organizationId: orgId,
      eventName: "Lead",
      gclid: lead?.first_gclid ?? null,
    });
  } catch (e) { console.error("wa capi lead", e); }
}
