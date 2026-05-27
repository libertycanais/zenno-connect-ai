import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callAI(model: string, messages: Array<{ role: string; content: string }>) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY ausente. Habilite Lovable AI.");
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages }),
  });
  if (res.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em alguns instantes.");
  if (res.status === 402) throw new Error("Créditos esgotados. Adicione créditos em Lovable AI.");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha na IA: ${res.status} ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// ============ Qualificar lead ============
export const qualifyLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ leadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: lead } = await supabase.from("leads").select("*").eq("id", data.leadId).single();
    if (!lead) throw new Error("Lead não encontrado");

    const { data: msgs } = await supabase
      .from("whatsapp_messages")
      .select("direction, content, created_at")
      .eq("lead_id", data.leadId)
      .order("created_at", { ascending: true })
      .limit(50);

    const history = (msgs ?? [])
      .map((m: any) => `[${m.direction}] ${m.content ?? ""}`)
      .join("\n");

    const content = await callAI("google/gemini-2.5-flash", [
      {
        role: "system",
        content: `Você é um especialista em qualificação de leads. Analise as informações e o histórico de conversas e retorne um JSON com: score (0-100), interest_level (baixo|médio|alto), recommended_status (novo|contato|qualificado|proposta|ganho|perdido), summary (resumo em 2-3 frases), next_action (próxima ação sugerida em 1 frase). Responda APENAS com JSON válido, sem markdown.`,
      },
      {
        role: "user",
        content: `Lead: ${lead.name}\nEmail: ${lead.email ?? "-"}\nTelefone: ${lead.phone ?? "-"}\nFonte: ${lead.source ?? "-"}\nStatus atual: ${lead.status}\nNotas: ${lead.notes ?? "-"}\n\nHistórico de conversa:\n${history || "(sem mensagens)"}`,
      },
    ]);

    let parsed: any = {};
    try {
      const clean = content.replace(/```json\n?|```/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      parsed = { summary: content };
    }
    return { result: parsed };
  });

// ============ Sugerir resposta WhatsApp ============
export const suggestReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      chatId: z.string().uuid(),
      tone: z.enum(["formal", "amigável", "vendedor", "suporte"]).default("amigável"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: chat } = await supabase.from("whatsapp_chats").select("*").eq("id", data.chatId).single();
    if (!chat) throw new Error("Conversa não encontrada");
    const { data: msgs } = await supabase
      .from("whatsapp_messages")
      .select("direction, content, created_at")
      .eq("chat_id", data.chatId)
      .order("created_at", { ascending: false })
      .limit(20);

    const history = (msgs ?? [])
      .reverse()
      .map((m: any) => `${m.direction === "in" ? "Cliente" : "Atendente"}: ${m.content ?? ""}`)
      .join("\n");

    const content = await callAI("google/gemini-2.5-flash", [
      {
        role: "system",
        content: `Você é um atendente profissional. Gere 3 sugestões de resposta no tom "${data.tone}" baseadas no histórico da conversa. Retorne JSON: { "suggestions": ["resp1", "resp2", "resp3"] }. Sem markdown.`,
      },
      {
        role: "user",
        content: `Cliente: ${chat.name ?? chat.phone}\n\nHistórico:\n${history || "(início)"}`,
      },
    ]);

    let parsed: any = { suggestions: [] };
    try {
      const clean = content.replace(/```json\n?|```/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      parsed = { suggestions: [content] };
    }
    return parsed;
  });

// ============ Resumir conversa ============
export const summarizeChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ chatId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: msgs } = await supabase
      .from("whatsapp_messages")
      .select("direction, content")
      .eq("chat_id", data.chatId)
      .order("created_at", { ascending: true });

    const history = (msgs ?? [])
      .map((m: any) => `${m.direction === "in" ? "Cliente" : "Atendente"}: ${m.content ?? ""}`)
      .join("\n");

    if (!history) return { summary: "Sem mensagens nesta conversa." };

    const content = await callAI("google/gemini-2.5-flash", [
      {
        role: "system",
        content: "Você resume conversas de atendimento de forma objetiva. Retorne um resumo em até 4 linhas e liste os pontos principais e pendências.",
      },
      { role: "user", content: history },
    ]);
    return { summary: content };
  });

// ============ Chat livre com assistente ============
export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(8000) })).min(1).max(30),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const content = await callAI("google/gemini-2.5-flash", [
      {
        role: "system",
        content: "Você é o assistente ZENNO, especialista em CRM, marketing digital, vendas, WhatsApp Business e gestão financeira. Responda em português, de forma direta e prática.",
      },
      ...data.messages,
    ]);
    return { reply: content };
  });
