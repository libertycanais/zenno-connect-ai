import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const baseCors = {
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "600",
  Vary: "Origin",
};
const corsFor = (o: string | null) => ({ ...baseCors, "Access-Control-Allow-Origin": o ?? "*" });

const hostOf = (u: string | null) => {
  if (!u) return null;
  try { return new URL(u).hostname.toLowerCase(); } catch { return null; }
};
const norm = (e: string) => e.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
function originAllowed(host: string | null, allowed: string[]) {
  if (!host) return false;
  return allowed.some((a) => {
    const n = norm(a); if (!n) return false;
    if (n.startsWith("*.")) return host === n.slice(2) || host.endsWith(n.slice(1));
    return host === n;
  });
}

const schema = z.object({
  pk: z.string().min(8).max(80),
  phone: z.string().min(8).max(20),
  session_id: z.string().min(8).max(128),
  message: z.string().max(500).optional(),
});

// Alfanumérico sem letras ambíguas (0/O, 1/I/L)
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function randomCode(len = 6) {
  let s = "";
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  for (let i = 0; i < len; i++) s += ALPHABET[buf[i] % ALPHABET.length];
  return s;
}

export const Route = createFileRoute("/api/public/track/wa-link")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => new Response(null, { status: 204, headers: corsFor(request.headers.get("origin")) }),
      POST: async ({ request }) => {
        const originHeader = request.headers.get("origin");
        const reqHost = hostOf(originHeader) ?? hostOf(request.headers.get("referer"));
        const cors = corsFor(originHeader);

        let json: unknown;
        try { json = await request.json(); } catch { return err(400, "invalid_json", cors); }
        const parsed = schema.safeParse(json);
        if (!parsed.success) return err(400, "invalid_payload", cors);
        const { pk, phone, session_id, message } = parsed.data;

        const { data: org } = await supabaseAdmin
          .from("organizations")
          .select("id, tracking_allowed_origins")
          .eq("tracking_public_key", pk)
          .maybeSingle();
        if (!org) return err(400, "invalid_pk", cors);

        const allowed = (org.tracking_allowed_origins ?? []) as string[];
        if (allowed.length === 0 || !originAllowed(reqHost, allowed)) {
          return err(403, "origin_not_allowed", cors);
        }

        const ip = request.headers.get("cf-connecting-ip")
          || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
          || "unknown";
        const { data: throttled } = await supabaseAdmin.rpc("track_rate_limit_hit", {
          _org: org.id, _ip: ip, _max: 30,
        });
        if (throttled === true) return err(429, "rate_limited", cors);

        // Gera código único
        const cleanPhone = phone.replace(/\D/g, "");
        let code = "";
        for (let attempt = 0; attempt < 5; attempt++) {
          code = randomCode(6);
          const { error } = await supabaseAdmin.from("whatsapp_tracking_codes").insert({
            code, organization_id: org.id, session_id, phone: cleanPhone,
          });
          if (!error) break;
          code = "";
        }
        if (!code) return err(500, "code_gen_failed", cors);

        const baseMsg = (message ?? "Olá, tenho interesse!").slice(0, 400);
        const fullMsg = `${baseMsg} [t:${code}]`;
        const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(fullMsg)}`;

        return new Response(JSON.stringify({ ok: true, url, code }), {
          status: 200,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      },
    },
  },
});

function err(status: number, code: string, cors: Record<string, string>) {
  return new Response(JSON.stringify({ ok: false, error: code }), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}
