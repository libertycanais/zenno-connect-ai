import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Webhook receiver for WhatsApp/Uazapi.
// Configure your Uazapi instance webhook to:
//   https://<your-app>/api/public/whatsapp/webhook/<instance_id>?secret=<webhook_secret>
// The secret comes from whatsapp_instances.webhook_secret and is rotated per row.

export const Route = createFileRoute("/api/public/whatsapp/webhook/$instanceId")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const url = new URL(request.url);
        const secret = url.searchParams.get("secret") ?? request.headers.get("x-webhook-secret");
        const instanceId = params.instanceId;

        if (!instanceId || !secret) {
          return new Response("Missing instance or secret", { status: 401 });
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
            await supabaseAdmin.rpc("noop").catch(() => {}); // placeholder; unread bump via update below
            await supabaseAdmin
              .from("whatsapp_chats")
              .update({ unread_count: (await supabaseAdmin.from("whatsapp_chats").select("unread_count").eq("id", chat.id).single()).data?.unread_count ?? 0 })
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
        }
        return new Response("ok");
      },
    },
  },
});
