import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const AuthType = z.enum(["none", "bearer", "api_key", "basic"]);
const Method = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);

const SAFE_COLS = "id,organization_id,name,description,base_url,auth_type,headers,status,created_at,updated_at,created_by";

function isSafePublicUrl(u: string): boolean {
  try {
    const p = new URL(u);
    if (p.protocol !== "https:" && p.protocol !== "http:") return false;
    if (p.protocol !== "https:") return false;
    const host = p.hostname.toLowerCase();
    if (["localhost", "0.0.0.0", "::", "::1"].includes(host)) return false;
    if (host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return false;
    if (host.startsWith("[")) return false; // IPv6 literal
    const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (m) {
      const a = parseInt(m[1]), b = parseInt(m[2]);
      if (a === 10 || a === 127 || a === 0) return false;
      if (a === 169 && b === 254) return false;
      if (a === 172 && b >= 16 && b <= 31) return false;
      if (a === 192 && b === 168) return false;
      if (a === 100 && b >= 64 && b <= 127) return false;
      if (a >= 224) return false;
    }
    return true;
  } catch {
    return false;
  }
}

const SSRF_MSG = "URL deve ser HTTPS pública (IPs privados/loopback bloqueados)";

async function getOrgId(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("organization_id").eq("id", userId).single();
  if (!data) throw new Error("Perfil não encontrado");
  return data.organization_id as string;
}

async function assertManagerRole(userId: string, orgId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", orgId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r: any) => r.role);
  if (!roles.some((r: string) => r === "owner" || r === "admin" || r === "manager")) {
    throw new Error("Acesso negado: apenas owner/admin/manager podem executar requisições");
  }
}

export const listIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const organization_id = await getOrgId(supabase, userId);
    // Use admin client + safe column projection so non-admin members can see the list without auth_token leaking
    const { data, error } = await supabaseAdmin
      .from("sigma_integrations")
      .select(SAFE_COLS)
      .eq("organization_id", organization_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { integrations: data ?? [] };
  });

export const createIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      name: z.string().min(1).max(80),
      description: z.string().max(500).optional(),
      base_url: z.string().url().refine(isSafePublicUrl, { message: SSRF_MSG }),
      auth_type: AuthType.default("none"),
      auth_token: z.string().max(2000).optional(),
      headers: z.record(z.string(), z.string()).default({}),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const organization_id = await getOrgId(supabase, userId);
    const { data: row, error } = await supabase
      .from("sigma_integrations")
      .insert({ ...data, organization_id, created_by: userId })
      .select(SAFE_COLS)
      .single();
    if (error) throw new Error(error.message);
    return { integration: row };
  });

export const updateIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(80).optional(),
      description: z.string().max(500).optional(),
      base_url: z.string().url().refine(isSafePublicUrl, { message: SSRF_MSG }).optional(),
      auth_type: AuthType.optional(),
      auth_token: z.string().max(2000).optional(),
      headers: z.record(z.string(), z.string()).optional(),
      status: z.enum(["active", "paused"]).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: any = { ...data };
    delete patch.id;
    const { error } = await context.supabase.from("sigma_integrations").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("sigma_integrations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const executeRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      integration_id: z.string().uuid(),
      method: Method,
      endpoint: z.string().min(1).max(500),
      body: z.any().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const organization_id = await getOrgId(supabase, userId);

    // Role gate: only managers+ can dispatch outbound requests
    await assertManagerRole(userId, organization_id);

    // Fetch full integration (with token) via admin client, scoped to caller's org
    const { data: intg, error: ie } = await supabaseAdmin
      .from("sigma_integrations")
      .select("*")
      .eq("id", data.integration_id)
      .eq("organization_id", organization_id)
      .single();
    if (ie || !intg) throw new Error("Integração não encontrada");

    const url = intg.base_url.replace(/\/+$/, "") + (data.endpoint.startsWith("/") ? data.endpoint : `/${data.endpoint}`);

    // Re-validate at execution time in case a stored URL was created before validation existed
    if (!isSafePublicUrl(url)) throw new Error(SSRF_MSG);

    const headers: Record<string, string> = { "Content-Type": "application/json", ...(intg.headers as Record<string, string>) };
    if (intg.auth_type === "bearer" && intg.auth_token) headers["Authorization"] = `Bearer ${intg.auth_token}`;
    if (intg.auth_type === "api_key" && intg.auth_token) headers["X-API-Key"] = intg.auth_token;
    if (intg.auth_type === "basic" && intg.auth_token) headers["Authorization"] = `Basic ${intg.auth_token}`;

    const t0 = Date.now();
    let status = 0;
    let responseBody: any = null;
    let error: string | null = null;
    try {
      const res = await fetch(url, {
        method: data.method,
        headers,
        body: data.method === "GET" ? undefined : JSON.stringify(data.body ?? {}),
        redirect: "manual",
      });
      status = res.status;
      const text = await res.text();
      try { responseBody = JSON.parse(text); } catch { responseBody = { raw: text.slice(0, 5000) }; }
    } catch (e: any) {
      error = e?.message ?? "Erro desconhecido";
    }
    const duration_ms = Date.now() - t0;

    await supabaseAdmin.from("sigma_requests").insert({
      organization_id,
      integration_id: data.integration_id,
      method: data.method,
      endpoint: data.endpoint,
      request_body: data.body ?? null,
      response_status: status || null,
      response_body: responseBody,
      error,
      duration_ms,
      triggered_by: userId,
    });

    return { status, response: responseBody, error, duration_ms };
  });

export const listRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ integration_id: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("sigma_requests").select("*").order("created_at", { ascending: false }).limit(100);
    if (data.integration_id) q = q.eq("integration_id", data.integration_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { requests: rows ?? [] };
  });
