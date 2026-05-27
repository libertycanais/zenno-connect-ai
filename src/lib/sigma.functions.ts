import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AuthType = z.enum(["none", "bearer", "api_key", "basic"]);
const Method = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);

async function getOrgId(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("organization_id").eq("id", userId).single();
  if (!data) throw new Error("Perfil não encontrado");
  return data.organization_id as string;
}

export const listIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("sigma_integrations").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { integrations: data ?? [] };
  });

export const createIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      name: z.string().min(1).max(80),
      description: z.string().max(500).optional(),
      base_url: z.string().url(),
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
      .select()
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
      base_url: z.string().url().optional(),
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
    const { data: intg, error: ie } = await supabase.from("sigma_integrations").select("*").eq("id", data.integration_id).single();
    if (ie || !intg) throw new Error("Integração não encontrada");

    const url = intg.base_url.replace(/\/+$/, "") + (data.endpoint.startsWith("/") ? data.endpoint : `/${data.endpoint}`);
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
      });
      status = res.status;
      const text = await res.text();
      try { responseBody = JSON.parse(text); } catch { responseBody = { raw: text.slice(0, 5000) }; }
    } catch (e: any) {
      error = e?.message ?? "Erro desconhecido";
    }
    const duration_ms = Date.now() - t0;

    await supabase.from("sigma_requests").insert({
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
