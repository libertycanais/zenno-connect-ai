// Readiness probe — "pronto para receber tráfego?".
// Verifica dependências críticas: PostgreSQL (obrigatório), Redis/BullMQ (opcional).
// Se qualquer dependência obrigatória falhar → HTTP 503.
// Kubernetes: readinessProbe.httpGet.path = /api/public/ready
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { log, logContextFromRequest } from "@/lib/logger";

type CheckResult = {
  status: "ok" | "fail" | "skipped";
  latency_ms?: number;
  error?: string;
};

async function checkPostgres(): Promise<CheckResult> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { status: "skipped", error: "no_credentials" };
  const started = Date.now();
  try {
    const supabase = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // Query leve — endpoint público padrão do PostgREST. Não expõe dados.
    const { error } = await supabase
      .from("organizations")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    if (error && !/permission|denied|row-level/i.test(error.message)) {
      // RLS bloqueando SELECT é sinal de que o banco está VIVO — apenas
      // erros de rede/conexão contam como falha.
      return { status: "fail", latency_ms: Date.now() - started, error: error.message };
    }
    return { status: "ok", latency_ms: Date.now() - started };
  } catch (e) {
    return {
      status: "fail",
      latency_ms: Date.now() - started,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function checkRedis(): Promise<CheckResult> {
  const url = process.env.REDIS_URL;
  if (!url) return { status: "skipped", error: "not_configured" };
  // Redis/BullMQ ainda não integrado no runtime. Quando o worker existir,
  // trocar por PING real. Enquanto isso reporta 'skipped'.
  return { status: "skipped", error: "not_wired_yet" };
}

export const Route = createFileRoute("/api/public/ready")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ctx = logContextFromRequest(request);
        const [postgres, redis] = await Promise.all([
          checkPostgres(),
          checkRedis(),
        ]);
        const criticalOk = postgres.status !== "fail";
        const status = criticalOk ? "ready" : "not_ready";
        const httpStatus = criticalOk ? 200 : 503;

        if (!criticalOk) {
          log.error(
            { ...ctx, event: "ready.fail", checks: { postgres, redis } },
            "readiness check failed",
          );
        }

        return Response.json(
          {
            status,
            timestamp: new Date().toISOString(),
            checks: { postgres, redis },
          },
          { status: httpStatus },
        );
      },
    },
  },
});
