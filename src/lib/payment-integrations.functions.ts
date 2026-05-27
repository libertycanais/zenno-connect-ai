import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Provider = z.enum(["asaas", "mercadopago"]);
const Environment = z.enum(["sandbox", "production"]);

const SAFE_COLS =
  "id,organization_id,provider,environment,status,last_checked_at,last_error,created_at,updated_at";

async function getOrgId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("organization_id").eq("id", userId).single();
  if (!data?.organization_id) throw new Error("Organização não encontrada para este usuário");
  return data.organization_id as string;
}

async function assertAdmin(userId: string, orgId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", orgId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r: any) => r.role);
  if (!roles.some((r: string) => r === "owner" || r === "admin")) {
    throw new Error("Acesso negado: apenas owner/admin podem gerenciar integrações");
  }
}

export const listPaymentIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const orgId = await getOrgId(supabase, userId);
    const { data, error } = await supabase
      .from("payment_integrations")
      .select(SAFE_COLS)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { integrations: data ?? [] };
  });

export const savePaymentIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { provider: string; environment: string; api_key: string }) =>
    z.object({
      provider: Provider,
      environment: Environment,
      api_key: z.string().trim().min(8, "API key inválida").max(2000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const orgId = await getOrgId(supabase, userId);
    await assertAdmin(userId, orgId);

    // Test the credentials before saving
    const test = await testProviderApi(data.provider, data.environment, data.api_key);

    const { data: row, error } = await supabaseAdmin
      .from("payment_integrations")
      .upsert(
        {
          organization_id: orgId,
          provider: data.provider,
          environment: data.environment,
          api_key: data.api_key,
          status: test.ok ? "active" : "error",
          last_checked_at: new Date().toISOString(),
          last_error: test.ok ? null : test.error,
          created_by: userId,
        },
        { onConflict: "organization_id,provider" },
      )
      .select(SAFE_COLS)
      .single();
    if (error) throw new Error(error.message);
    return { integration: row, test };
  });

export const testPaymentIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const orgId = await getOrgId(supabase, userId);
    await assertAdmin(userId, orgId);

    const { data: row, error } = await supabaseAdmin
      .from("payment_integrations")
      .select("id,provider,environment,api_key,organization_id")
      .eq("id", data.id)
      .eq("organization_id", orgId)
      .single();
    if (error || !row) throw new Error("Integração não encontrada");

    const test = await testProviderApi(row.provider, row.environment, row.api_key);
    await supabaseAdmin
      .from("payment_integrations")
      .update({
        status: test.ok ? "active" : "error",
        last_checked_at: new Date().toISOString(),
        last_error: test.ok ? null : test.error,
      })
      .eq("id", row.id);
    return test;
  });

export const deletePaymentIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const orgId = await getOrgId(supabase, userId);
    await assertAdmin(userId, orgId);
    const { error } = await supabaseAdmin
      .from("payment_integrations")
      .delete()
      .eq("id", data.id)
      .eq("organization_id", orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function testProviderApi(
  provider: string,
  environment: string,
  apiKey: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (provider === "asaas") {
      const base =
        environment === "production"
          ? "https://api.asaas.com/v3"
          : "https://api-sandbox.asaas.com/v3";
      const r = await fetch(`${base}/myAccount`, {
        method: "GET",
        headers: { access_token: apiKey, "Content-Type": "application/json" },
      });
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        return { ok: false, error: `Asaas ${r.status}: ${t.slice(0, 200)}` };
      }
      return { ok: true };
    }
    if (provider === "mercadopago") {
      const r = await fetch("https://api.mercadopago.com/users/me", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        return { ok: false, error: `Mercado Pago ${r.status}: ${t.slice(0, 200)}` };
      }
      return { ok: true };
    }
    return { ok: false, error: "Provedor desconhecido" };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Falha de rede" };
  }
}
