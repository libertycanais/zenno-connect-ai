import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "anthropic/claude-sonnet-4.5";

// ---------- Tool schema exposed to the model (read-only phase) ----------
const TOOLS = [
  {
    type: "function",
    function: {
      name: "list_client_accounts",
      description: "Lista todas as contas de anúncio (Meta e Google) conectadas na organização, agrupadas por MCC/BM.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "list_campaigns",
      description: "Lista campanhas do cliente ativo. Filtra por plataforma opcional.",
      parameters: {
        type: "object",
        properties: {
          platform: { type: "string", enum: ["meta", "google", "all"], description: "Plataforma" },
          status: { type: "string", description: "Filtrar por status (ACTIVE, PAUSED, ...)" },
          limit: { type: "number", description: "Máximo de linhas", default: 30 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_campaign_performance",
      description: "Retorna métricas agregadas (gasto, leads, CPA) das campanhas nos últimos N dias.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Janela em dias (default 7)", default: 7 },
          platform: { type: "string", enum: ["meta", "google", "all"] },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "recent_leads_summary",
      description: "Resumo dos leads recebidos nos últimos N dias com origem/utm_source.",
      parameters: {
        type: "object",
        properties: { days: { type: "number", default: 7 } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "pause_campaign",
      description: "Pausa uma campanha. Requer aprovação humana antes de executar.",
      parameters: {
        type: "object",
        properties: {
          platform: { type: "string", enum: ["meta", "google"] },
          campaign_id: { type: "string", description: "UUID da campanha (id local no banco)" },
        },
        required: ["platform", "campaign_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "resume_campaign",
      description: "Reativa uma campanha pausada. Requer aprovação humana antes de executar.",
      parameters: {
        type: "object",
        properties: {
          platform: { type: "string", enum: ["meta", "google"] },
          campaign_id: { type: "string" },
        },
        required: ["platform", "campaign_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_daily_budget",
      description: "Ajusta o orçamento diário de uma campanha em reais (BRL). Requer aprovação humana antes de executar.",
      parameters: {
        type: "object",
        properties: {
          platform: { type: "string", enum: ["meta", "google"] },
          campaign_id: { type: "string" },
          new_daily_budget_brl: { type: "number", description: "Novo valor em BRL, ex: 50 = R$ 50/dia" },
        },
        required: ["platform", "campaign_id", "new_daily_budget_brl"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_campaign",
      description: "Cria uma nova campanha (por enquanto, apenas Meta Ads). A campanha nasce PAUSADA para revisão. Requer aprovação humana.",
      parameters: {
        type: "object",
        properties: {
          platform: { type: "string", enum: ["meta"] },
          account_id: { type: "string", description: "UUID local (id) da conta em meta_ad_accounts (use list_client_accounts para descobrir)" },
          name: { type: "string", description: "Nome da campanha" },
          objective: {
            type: "string",
            enum: ["OUTCOME_TRAFFIC", "OUTCOME_LEADS", "OUTCOME_SALES", "OUTCOME_ENGAGEMENT", "OUTCOME_AWARENESS", "OUTCOME_APP_PROMOTION"],
            description: "Objetivo Meta ODAX",
          },
          daily_budget_brl: { type: "number", description: "Orçamento diário em BRL" },
        },
        required: ["platform", "account_id", "name", "objective", "daily_budget_brl"],
        additionalProperties: false,
      },
    },
  },
] as const;

const WRITE_TOOLS = new Set(["pause_campaign", "resume_campaign", "update_daily_budget", "create_campaign"]);

// ---------- Tool executor (runs server-side with user's supabase client) ----------
type ToolCtx = { supabase: any; orgId: string; userId: string; convId: string; toolCallId: string };

async function runTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolCtx,
): Promise<unknown> {
  const { supabase, orgId, userId, convId, toolCallId } = ctx;

  if (name === "list_client_accounts") {
    const [meta, google] = await Promise.all([
      supabase
        .from("meta_ad_accounts")
        .select("id, name, ad_account_id, business_name, is_manager, is_client_account, status")
        .eq("organization_id", orgId)
        .limit(200),
      supabase
        .from("google_ad_accounts")
        .select("id, name, descriptive_name, customer_id, manager_customer_id, is_manager, status")
        .eq("organization_id", orgId)
        .limit(200),
    ]);
    return {
      meta: meta.data ?? [],
      google: google.data ?? [],
    };
  }

  if (name === "list_campaigns") {
    const platform = (args.platform as string) ?? "all";
    const status = args.status as string | undefined;
    const limit = Math.min(Number(args.limit ?? 30), 100);
    const out: any = {};
    if (platform === "meta" || platform === "all") {
      let q = supabase
        .from("meta_campaigns")
        .select("id, name, objective, status, daily_budget, lifetime_budget")
        .eq("organization_id", orgId)
        .limit(limit);
      if (status) q = q.eq("status", status);
      const r = await q;
      out.meta = r.data ?? [];
    }
    if (platform === "google" || platform === "all") {
      const r = await supabase
        .from("google_ad_accounts")
        .select("id, name, customer_id")
        .eq("organization_id", orgId)
        .limit(limit);
      out.google_accounts = r.data ?? [];
    }
    return out;
  }

  if (name === "get_campaign_performance") {
    const days = Math.min(Number(args.days ?? 7), 90);
    const since = new Date(Date.now() - days * 86400_000).toISOString();
    const [meta, google] = await Promise.all([
      supabase
        .from("meta_conversion_events")
        .select("event_name, value, created_at")
        .eq("organization_id", orgId)
        .gte("created_at", since)
        .limit(1000),
      supabase
        .from("google_ads_conversions")
        .select("conversion_action, conversion_value, created_at")
        .eq("organization_id", orgId)
        .gte("created_at", since)
        .limit(1000),
    ]);
    const metaAgg: Record<string, { count: number; value: number }> = {};
    for (const e of meta.data ?? []) {
      const k = e.event_name ?? "unknown";
      metaAgg[k] ??= { count: 0, value: 0 };
      metaAgg[k].count++;
      metaAgg[k].value += Number(e.value ?? 0);
    }
    const googleAgg: Record<string, { count: number; value: number }> = {};
    for (const e of google.data ?? []) {
      const k = e.conversion_action ?? "unknown";
      googleAgg[k] ??= { count: 0, value: 0 };
      googleAgg[k].count++;
      googleAgg[k].value += Number(e.conversion_value ?? 0);
    }
    return { days, meta: metaAgg, google: googleAgg };
  }

  if (name === "recent_leads_summary") {
    const days = Math.min(Number(args.days ?? 7), 90);
    const since = new Date(Date.now() - days * 86400_000).toISOString();
    const r = await supabase
      .from("leads")
      .select("id, name, source, status, created_at")
      .eq("organization_id", orgId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200);
    const bySource: Record<string, number> = {};
    for (const l of r.data ?? []) {
      const k = l.source ?? "direto";
      bySource[k] = (bySource[k] ?? 0) + 1;
    }
    return { total: r.data?.length ?? 0, by_source: bySource, sample: (r.data ?? []).slice(0, 20) };
  }

  if (WRITE_TOOLS.has(name)) {
    return await stagePendingAction(name, args, ctx);
  }

  return { error: `tool_unknown:${name}` };
}

async function stagePendingAction(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolCtx,
): Promise<unknown> {
  const { supabase, orgId, userId, convId, toolCallId } = ctx;
  const platform = String(args.platform ?? "");

  let campaignName = "";
  let accountRowId: string | null = null;
  let preview = "";

  if (name === "create_campaign") {
    if (platform !== "meta") return { error: "create_campaign_meta_only" };
    accountRowId = String(args.account_id ?? "");
    if (!accountRowId) return { error: "missing_account_id" };
    const { data: acc } = await supabase
      .from("meta_ad_accounts")
      .select("id, name, organization_id")
      .eq("id", accountRowId).maybeSingle();
    if (!acc || acc.organization_id !== orgId) return { error: "account_not_found_or_forbidden" };
    const nm = String(args.name ?? "");
    const obj = String(args.objective ?? "");
    const brl = Number(args.daily_budget_brl ?? 0);
    if (!nm || !obj || !(brl > 0)) return { error: "missing_fields" };
    preview = `Criar campanha Meta "${nm}" na conta ${acc.name} — objetivo ${obj}, R$ ${brl.toFixed(2)}/dia (nasce PAUSADA)`;
  } else {
    const campaignId = String(args.campaign_id ?? "");
    if (!platform || !campaignId) return { error: "missing_platform_or_campaign_id" };
    campaignName = campaignId;

    if (platform === "meta") {
      const { data } = await supabase
        .from("meta_campaigns")
        .select("id, name, ad_account_id, organization_id, daily_budget, status")
        .eq("id", campaignId).maybeSingle();
      if (!data || data.organization_id !== orgId) return { error: "campaign_not_found_or_forbidden" };
      campaignName = data.name;
      accountRowId = data.ad_account_id;
    } else if (platform === "google") {
      const { data } = await supabase
        .from("google_ads_campaigns")
        .select("id, name, account_id, organization_id, budget_amount, status")
        .eq("id", campaignId).maybeSingle();
      if (!data || data.organization_id !== orgId) return { error: "campaign_not_found_or_forbidden" };
      campaignName = data.name;
      accountRowId = data.account_id;
    } else {
      return { error: "invalid_platform" };
    }

    if (name === "pause_campaign") preview = `Pausar a campanha "${campaignName}" (${platform.toUpperCase()})`;
    else if (name === "resume_campaign") preview = `Reativar a campanha "${campaignName}" (${platform.toUpperCase()})`;
    else if (name === "update_daily_budget") {
      const brl = Number(args.new_daily_budget_brl ?? 0);
      preview = `Alterar orçamento diário de "${campaignName}" (${platform.toUpperCase()}) para R$ ${brl.toFixed(2)}/dia`;
    }
  }

  const { data: pending, error } = await supabase
    .from("ai_copilot_pending_actions")
    .insert({
      organization_id: orgId,
      conversation_id: convId,
      user_id: userId,
      tool_name: name,
      tool_call_id: toolCallId,
      tool_args: args,
      preview,
      platform,
      account_id: accountRowId,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) return { error: `pending_action_error: ${error.message}` };

  return {
    status: "pending_approval",
    pending_id: pending.id,
    preview,
    message: "Ação aguardando aprovação do usuário. NÃO foi executada ainda.",
  };
}
async function callGateway(payload: unknown) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY ausente. Habilite Lovable AI.");
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.status === 429) throw new Error("Limite atingido. Aguarde alguns instantes.");
  if (res.status === 402) throw new Error("Créditos esgotados. Adicione créditos em Lovable AI.");
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI Gateway ${res.status}: ${t.slice(0, 300)}`);
  }
  return res.json();
}

const SYSTEM_PROMPT = `Você é o Copiloto de Tráfego da ZENNO — um especialista sênior em Meta Ads e Google Ads que ajuda gestores de tráfego a analisar contas de clientes, diagnosticar performance e sugerir otimizações.

Regras:
- Sempre use as ferramentas disponíveis para buscar dados reais antes de opinar.
- Responda em português do Brasil, direto ao ponto, com bullets curtos.
- Formate valores monetários em BRL (R$).
- Se o usuário pedir algo sem ter contas conectadas, sugira ir em /app/integracoes.
- Para pausar/reativar campanhas ou ajustar orçamentos, use as ferramentas de escrita — elas SEMPRE pedem aprovação humana antes de executar de fato. Explique o que vai fazer, chame a tool e diga que a ação ficou pendente aguardando o clique do usuário.
- Nunca invente IDs de campanha; primeiro liste com list_campaigns.`;


// ---------- Main server function ----------
export const copilotChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        conversationId: z.string().uuid().nullable().optional(),
        message: z.string().min(1).max(4000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Resolve org from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.organization_id) throw new Error("Sem organização vinculada.");
    const orgId = profile.organization_id as string;

    // Get/create conversation
    let convId = data.conversationId ?? null;
    if (!convId) {
      const { data: conv, error } = await supabase
        .from("ai_copilot_conversations")
        .insert({
          organization_id: orgId,
          user_id: userId,
          title: data.message.slice(0, 60),
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      convId = conv.id;
    }

    // Persist user message
    await supabase.from("ai_copilot_messages").insert({
      conversation_id: convId,
      organization_id: orgId,
      role: "user",
      content: data.message,
    });

    // Load history
    const { data: history } = await supabase
      .from("ai_copilot_messages")
      .select("role, content, tool_calls, tool_call_id, tool_name")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(40);

    const messages: any[] = [{ role: "system", content: SYSTEM_PROMPT }];
    for (const m of history ?? []) {
      if (m.role === "assistant" && m.tool_calls) {
        messages.push({ role: "assistant", content: m.content ?? "", tool_calls: m.tool_calls });
      } else if (m.role === "tool") {
        messages.push({
          role: "tool",
          tool_call_id: m.tool_call_id,
          name: m.tool_name,
          content: m.content ?? "",
        });
      } else {
        messages.push({ role: m.role, content: m.content ?? "" });
      }
    }

    // Iterate tool calls (max 6 steps)
    let finalContent = "";
    for (let step = 0; step < 6; step++) {
      const resp: any = await callGateway({
        model: MODEL,
        messages,
        tools: TOOLS,
        tool_choice: "auto",
      });
      const choice = resp.choices?.[0]?.message;
      if (!choice) throw new Error("Resposta vazia do modelo.");

      if (choice.tool_calls && choice.tool_calls.length > 0) {
        // persist assistant tool_call message
        await supabase.from("ai_copilot_messages").insert({
          conversation_id: convId,
          organization_id: orgId,
          role: "assistant",
          content: choice.content ?? "",
          tool_calls: choice.tool_calls,
        });
        messages.push({ role: "assistant", content: choice.content ?? "", tool_calls: choice.tool_calls });

        for (const tc of choice.tool_calls) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.function?.arguments ?? "{}");
          } catch {
            args = {};
          }
          const result = await runTool(tc.function.name, args, {
            supabase, orgId, userId, convId: convId!, toolCallId: tc.id,
          });
          const resultStr = JSON.stringify(result).slice(0, 8000);
          await supabase.from("ai_copilot_messages").insert({
            conversation_id: convId,
            organization_id: orgId,
            role: "tool",
            content: resultStr,
            tool_call_id: tc.id,
            tool_name: tc.function.name,
          });
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            name: tc.function.name,
            content: resultStr,
          });
        }
        continue;
      }

      finalContent = choice.content ?? "";
      await supabase.from("ai_copilot_messages").insert({
        conversation_id: convId,
        organization_id: orgId,
        role: "assistant",
        content: finalContent,
      });
      break;
    }

    await supabase
      .from("ai_copilot_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", convId);

    return { conversationId: convId, reply: finalContent };
  });

export const listCopilotConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("ai_copilot_conversations")
      .select("id, title, updated_at")
      .order("updated_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return { conversations: data ?? [] };
  });

export const getCopilotConversation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: msgs, error } = await supabase
      .from("ai_copilot_messages")
      .select("id, role, content, tool_name, tool_call_id, created_at")
      .eq("conversation_id", data.id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { messages: msgs ?? [] };
  });

// ================= PENDING ACTIONS =================
export const listPendingActions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ conversationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("ai_copilot_pending_actions")
      .select("id, tool_name, tool_call_id, tool_args, preview, platform, status, result, error, executed_at, created_at")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { actions: rows ?? [] };
  });

export const rejectPendingAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("ai_copilot_pending_actions")
      .update({ status: "rejected" })
      .eq("id", data.id)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const approvePendingAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: pa, error: perr } = await supabase
      .from("ai_copilot_pending_actions")
      .select("id, conversation_id, organization_id, tool_name, tool_args, platform, status, preview")
      .eq("id", data.id).single();
    if (perr || !pa) throw new Error("Ação não encontrada.");
    if (pa.status !== "pending") throw new Error(`Ação já processada (${pa.status}).`);

    const args = (pa.tool_args ?? {}) as Record<string, unknown>;
    const campaignId = String(args.campaign_id ?? "");
    const platform = String(args.platform ?? pa.platform ?? "");

    const exec = await import("./copilot-executors.server");
    let result: unknown;
    try {
      if (pa.tool_name === "pause_campaign") {
        result = platform === "meta"
          ? await exec.metaUpdateCampaign(supabase, campaignId, { status: "PAUSED" })
          : await exec.googleUpdateCampaignStatus(supabase, campaignId, "PAUSED");
      } else if (pa.tool_name === "resume_campaign") {
        result = platform === "meta"
          ? await exec.metaUpdateCampaign(supabase, campaignId, { status: "ACTIVE" })
          : await exec.googleUpdateCampaignStatus(supabase, campaignId, "ENABLED");
      } else if (pa.tool_name === "update_daily_budget") {
        const brl = Number(args.new_daily_budget_brl ?? 0);
        if (!(brl > 0)) throw new Error("Orçamento inválido.");
        result = platform === "meta"
          ? await exec.metaUpdateCampaign(supabase, campaignId, { daily_budget_cents: Math.round(brl * 100) })
          : await exec.googleUpdateCampaignBudget(supabase, campaignId, Math.round(brl * 1_000_000));
      } else if (pa.tool_name === "create_campaign") {
        if (platform !== "meta") throw new Error("create_campaign: apenas Meta por enquanto.");
        result = await exec.metaCreateCampaign(supabase, String(args.account_id ?? ""), {
          name: String(args.name ?? ""),
          objective: String(args.objective ?? ""),
          daily_budget_cents: Math.round(Number(args.daily_budget_brl ?? 0) * 100),
        });
      } else {
        throw new Error(`Ferramenta desconhecida: ${pa.tool_name}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabase.from("ai_copilot_pending_actions")
        .update({ status: "failed", error: msg })
        .eq("id", pa.id);
      throw new Error(msg);
    }

    await supabase.from("ai_copilot_pending_actions")
      .update({ status: "executed", result: result as any, executed_at: new Date().toISOString() })
      .eq("id", pa.id);

    // Log a system message so the model sees the outcome on next turn
    await supabase.from("ai_copilot_messages").insert({
      conversation_id: pa.conversation_id,
      organization_id: pa.organization_id,
      role: "assistant",
      content: `✅ Ação executada: ${pa.preview}`,
    });

    return { ok: true };
  });
