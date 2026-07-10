// RC2 Operational Enhancements — Pilot Daily Dashboard.
// Server-side aggregation via getPilotDailyDashboard (RLS applies).
// No cross-tenant computation on the client; every metric comes pre-rolled.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { getPilotDailyDashboard } from "@/lib/pilot.functions";
import {
  Activity, Users, MessageSquare, TrendingUp, ShieldCheck, Zap,
  ThumbsUp, ThumbsDown, AlertTriangle, Gauge, DollarSign, Layers,
} from "lucide-react";

export const Route = createFileRoute("/app/admin/pilot/daily")({
  component: PilotDailyDashboard,
  head: () => ({
    meta: [
      { title: "Pilot · Daily Dashboard — Zenno AI Suite" },
      { name: "description", content: "Operational cockpit for the RC2 Pilot Program." },
    ],
  }),
});

function PilotDailyDashboard() {
  const fetchDashboard = useServerFn(getPilotDailyDashboard);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["pilot-daily-dashboard"],
    queryFn: () => fetchDashboard(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <Card className="p-6 border-destructive/50">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle size={18} />
          <span className="font-medium">Falha ao carregar o dashboard diário.</span>
        </div>
        <button onClick={() => refetch()} className="mt-3 text-xs underline text-muted-foreground">
          Tentar novamente
        </button>
      </Card>
    );
  }

  const t = data!.totals;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pilot · Daily Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Janela de 24 horas · atualizado {new Date(data!.generatedAt).toLocaleString()}
            {isFetching && <span className="ml-2 text-primary">· atualizando…</span>}
          </p>
        </div>
        <Badge variant="outline">RC2 · Pilot Program</Badge>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <Kpi icon={Users} label="Orgs ativas" value={`${t.activeOrgs} / ${t.totalPilotOrgs}`} />
        <Kpi icon={Users} label="Usuários ativos (24h)" value={String(t.activeUsers)} />
        <Kpi icon={Activity} label="Sessões (24h)" value={String(t.sessions)} hint={`${t.sessionsCompleted} concluídas`} />
        <Kpi icon={Gauge} label="Duração média de sessão" value={t.avgSessionMs ? `${Math.round(t.avgSessionMs / 1000)}s` : "—"} />
        <Kpi icon={TrendingUp} label="Health Score médio" value={t.avgHealthScore.toFixed(2)} tone={healthTone(t.avgHealthScore)} />
        <Kpi icon={TrendingUp} label="Adoption Score médio" value={t.avgAdoptionScore.toFixed(2)} />
        <Kpi icon={Zap} label="Copilot invocations (24h)" value={String(t.copilotInvocations)} hint={t.avgCopilotLatencyMs ? `latência média ${t.avgCopilotLatencyMs} ms` : undefined} />
        <Kpi icon={ThumbsUp} label="Satisfação Copilot" value={t.copilotSatisfaction != null ? `${Math.round(t.copilotSatisfaction * 100)}%` : "—"} hint={`${t.copilotThumbsUp}👍 / ${t.copilotThumbsDown}👎`} />
        <Kpi icon={MessageSquare} label="Recs aceitas" value={String(t.recommendationsAccepted)} />
        <Kpi icon={ThumbsDown} label="Recs ignoradas" value={String(t.recommendationsIgnored)} />
        <Kpi icon={DollarSign} label="Custo IA (24h)" value={`$${t.aiCostUsd.toFixed(2)}`} hint={`${t.aiTokens.toLocaleString()} tokens`} />
        <Kpi icon={AlertTriangle} label="Taxa de erro" value={`${(t.errorRate * 100).toFixed(2)}%`} tone={t.errorRate > 0.02 ? "text-destructive" : undefined} hint={`p95 ${t.p95LatencyMs ?? "—"} ms`} />
        <Kpi icon={ShieldCheck} label="Feature flags ativas" value={String(t.featureFlagsEnabled)} hint={`rollout médio ${t.featureFlagsAvgRollout}%`} />
        <Kpi icon={Layers} label="Eventos telemetria (24h)" value={t.eventsLast24h.toLocaleString()} hint={t.telemetryBlockedByRateLimit ? `${t.telemetryBlockedByRateLimit} bloqueados por rate limit` : undefined} tone={t.telemetryBlockedByRateLimit ? "text-amber-500" : undefined} />
        <Kpi icon={MessageSquare} label="Feedback recebido (14d)" value={String(t.feedbackCount)} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Widgets mais utilizados</h2>
          {data!.topWidgets.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem uso registrado ainda.</p>
          ) : (
            <ul className="space-y-2">
              {data!.topWidgets.map((w) => {
                const max = data!.topWidgets[0].count || 1;
                return (
                  <li key={w.widget} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{w.widget}</span>
                      <span className="text-muted-foreground">{w.count}</span>
                    </div>
                    <Progress value={(w.count / max) * 100} />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Cohorts</h2>
          {data!.cohorts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma organização vinculada ao piloto.</p>
          ) : (
            <div className="space-y-3">
              {data!.cohorts.map((c) => (
                <div key={c.organizationId} className="text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono truncate max-w-[220px]">{c.organizationId}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{c.cohort}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{c.status}</Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    <ScorePill label="Health" value={c.healthScore} />
                    <ScorePill label="Adoption" value={c.adoptionScore} />
                    <ScorePill label="TTFV" value={c.ttfvSeconds ? `${c.ttfvSeconds}s` : "—"} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint, tone }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string; value: string; hint?: string; tone?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</span>
        <Icon size={14} className="text-muted-foreground" />
      </div>
      <div className={`text-2xl font-bold mt-1 ${tone ?? ""}`}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </Card>
  );
}

function ScorePill({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1">
      <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
      <div className="text-sm font-semibold">{typeof value === "number" ? value.toFixed(2) : value}</div>
    </div>
  );
}

function healthTone(score: number): string | undefined {
  if (score >= 75) return "text-emerald-500";
  if (score >= 50) return "text-amber-500";
  return "text-destructive";
}
