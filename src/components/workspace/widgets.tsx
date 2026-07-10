// EPIC K.2 — Widget catalog (Executive Score, Recommendations, Insights, Signals,
// Timeline, Forecast, Business DNA, Memory, Consensus, Learning, Notifications, Action Center)
// Pure presentational — consumes existing server functions via useServerFn.

import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  WidgetContainer, WidgetLoader, WidgetEmpty, WidgetError,
} from "./WorkspaceGrid";
import { getIntelligenceWidgets } from "@/lib/experts-analytics.functions";
import { getExecutiveSnapshot } from "@/lib/executive-dashboard.functions";
import { listPendingActions } from "@/lib/copilot.functions";
import { listAIMemory } from "@/lib/ai-copilot.functions";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";

function money(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ── Executive Score ──────────────────────────────────────────────────────
export function ExecutiveScoreWidget() {
  const fn = useServerFn(getExecutiveSnapshot);
  const q = useQuery({
    queryKey: ["exec", "snapshot", 30],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => fn({ data: { days: 30 } as any }),
    staleTime: 60_000,
  });
  return (
    <WidgetContainer title="Executive Score" subtitle="Snapshot 30 dias">
      {q.isLoading ? <WidgetLoader lines={3} /> :
        q.isError ? <WidgetError message="Falha ao carregar snapshot" onRetry={() => q.refetch()} /> :
        !q.data ? <WidgetEmpty /> :
        (() => {
          const b = q.data.billing;
          const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
          return (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="MRR" value={brl(b.mrr)} />
              <Stat label="Ativos" value={String(b.active)} />
              <Stat label="Churn" value={`${(b.churnRate * 100).toFixed(1)}%`} />
              <Stat label="ARR" value={brl(b.arr)} />
            </div>
          );
        })()
      }
    </WidgetContainer>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/30 p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

// ── Recommendations ──────────────────────────────────────────────────────
export function RecommendationsWidget() {
  const fn = useServerFn(getIntelligenceWidgets);
  const q = useQuery({ queryKey: ["intel", "widgets"], queryFn: () => fn(), staleTime: 60_000 });
  return (
    <WidgetContainer title="Recomendações" subtitle="Top oportunidades abertas">
      {q.isLoading ? <WidgetLoader /> :
        q.isError ? <WidgetError message="Falha ao carregar" onRetry={() => q.refetch()} /> :
        !q.data || q.data.topOpen.length === 0 ? <WidgetEmpty message="Nenhuma recomendação em aberto." /> :
        <ul className="space-y-2">
          {q.data.topOpen.slice(0, 4).map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{r.summary}</p>
                <p className="text-xs text-muted-foreground">Confiança {(r.confidence * 100).toFixed(0)}%</p>
              </div>
              <Badge variant={r.urgency === "critical" ? "destructive" : "outline"} className="shrink-0">
                {r.urgency}
              </Badge>
            </li>
          ))}
        </ul>
      }
    </WidgetContainer>
  );
}

// ── Insights (quality) ───────────────────────────────────────────────────
export function InsightsWidget() {
  const fn = useServerFn(getIntelligenceWidgets);
  const q = useQuery({ queryKey: ["intel", "widgets"], queryFn: () => fn(), staleTime: 60_000 });
  return (
    <WidgetContainer title="Qualidade dos Insights">
      {q.isLoading ? <WidgetLoader lines={2} /> :
        q.isError ? <WidgetError message="Falha ao carregar" /> :
        !q.data ? <WidgetEmpty /> :
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="Confiança média" value={`${(q.data.quality.avgConfidence * 100).toFixed(0)}%`} />
          <Stat label="Críticos" value={String(q.data.quality.criticalCount)} />
          <Stat label="Alta prioridade" value={String(q.data.quality.highCount)} />
          <Stat label="Evidências" value={String(q.data.totals.evidence)} />
        </div>
      }
    </WidgetContainer>
  );
}

// ── Timeline (created vs resolved) ───────────────────────────────────────
export function TimelineWidget() {
  const fn = useServerFn(getIntelligenceWidgets);
  const q = useQuery({ queryKey: ["intel", "widgets"], queryFn: () => fn(), staleTime: 60_000 });
  return (
    <WidgetContainer title="Timeline de Recomendações" subtitle="Últimos 14 dias">
      {q.isLoading ? <WidgetLoader /> :
        q.isError ? <WidgetError message="Falha ao carregar" /> :
        !q.data ? <WidgetEmpty /> :
        <div className="flex items-end gap-1 h-24">
          {q.data.timeline.map((d) => {
            const max = Math.max(1, ...q.data!.timeline.map((x) => x.created));
            const h = Math.max(2, Math.round((d.created / max) * 88));
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t bg-primary/60" style={{ height: `${h}px` }} />
                <span className="text-[9px] text-muted-foreground">{d.date.slice(5)}</span>
              </div>
            );
          })}
        </div>
      }
    </WidgetContainer>
  );
}

// ── Signals + Forecast + Consensus + Learning (derived / placeholder textual) ──
export function SignalsWidget() {
  const fn = useServerFn(getIntelligenceWidgets);
  const q = useQuery({ queryKey: ["intel", "widgets"], queryFn: () => fn(), staleTime: 60_000 });
  return (
    <WidgetContainer title="Sinais Recentes" subtitle="Detectados pelo Monitoring Engine">
      {q.isLoading ? <WidgetLoader lines={3} /> :
        !q.data ? <WidgetEmpty /> :
        <div className="text-sm space-y-1">
          <p className="flex items-center gap-2"><TrendingUp size={14} className="text-emerald-500" /> {q.data.totals.recommendations} recomendações no ciclo</p>
          <p className="flex items-center gap-2"><TrendingDown size={14} className="text-destructive" /> {q.data.totals.open} em aberto</p>
          <p className="text-xs text-muted-foreground">ROI estimado: {money(q.data.financial.estimatedRoiCents)}</p>
        </div>
      }
    </WidgetContainer>
  );
}

export function ForecastWidget() {
  const fn = useServerFn(getExecutiveSnapshot);
  const q = useQuery({
    queryKey: ["exec", "snapshot", 30],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => fn({ data: { days: 30 } as any }),
    staleTime: 60_000,
  });
  return (
    <WidgetContainer title="Forecast (30d)" subtitle="Baseado em economics">
      {q.isLoading ? <WidgetLoader lines={2} /> :
        !q.data ? <WidgetEmpty /> :
        <div className="text-sm space-y-1">
          <p className="text-muted-foreground text-xs">Projeção linear da série diária.</p>
          <p><strong>{q.data.daily.length}</strong> dias de dados analisados.</p>
        </div>
      }
    </WidgetContainer>
  );
}

export function BusinessDNAWidget() {
  return (
    <WidgetContainer title="Business DNA" subtitle="Perfil organizacional">
      <div className="text-sm space-y-1 text-muted-foreground">
        <p>Perfil derivado da Memória Organizacional e do histórico de decisões.</p>
        <p className="text-xs">Ver detalhes em <strong className="text-foreground">Memória</strong>.</p>
      </div>
    </WidgetContainer>
  );
}

export function MemoryWidget() {
  const fn = useServerFn(listAIMemory);
  const q = useQuery({
    queryKey: ["ai", "memory"],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => fn({ data: {} as any }).catch(() => ({ memory: [] as any[] })),
    staleTime: 60_000,
  });
  const items = (q.data?.memory ?? []) as Array<{ id: string; kind?: string; summary?: string }>;
  return (
    <WidgetContainer title="Memória" subtitle="Registros recentes">
      {q.isLoading ? <WidgetLoader /> :
        items.length === 0 ? <WidgetEmpty message="Nenhuma memória registrada ainda." /> :
        <ul className="space-y-1 text-sm">
          {items.slice(0, 5).map((m) => (
            <li key={m.id} className="truncate">
              <Badge variant="outline" className="mr-2">{m.kind ?? "note"}</Badge>
              {m.summary ?? "—"}
            </li>
          ))}
        </ul>
      }
    </WidgetContainer>
  );
}

export function ConsensusWidget() {
  return (
    <WidgetContainer title="Consensus" subtitle="Executive Decision Engine">
      <p className="text-sm text-muted-foreground">Rodadas de consenso multi-expert acessíveis em Relatórios.</p>
    </WidgetContainer>
  );
}

export function LearningWidget() {
  return (
    <WidgetContainer title="Learning Engine" subtitle="Feedback loop">
      <p className="text-sm text-muted-foreground">Modelos ajustados a partir de feedback explícito e outcomes.</p>
    </WidgetContainer>
  );
}

// ── Notifications (pending actions preview) ──────────────────────────────
export function NotificationsWidget() {
  const fn = useServerFn(listPendingActions);
  const q = useQuery({
    queryKey: ["notifications", "pending"],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => fn({ data: {} as any }).catch(() => ({ actions: [] as any[] })),
    staleTime: 30_000,
  });
  const items = (q.data?.actions ?? []) as Array<{ id: string; summary?: string; status?: string }>;
  return (
    <WidgetContainer title="Notificações" subtitle="Ações pendentes do Copilot">
      {q.isLoading ? <WidgetLoader /> :
        items.length === 0 ? <WidgetEmpty message="Sem pendências." /> :
        <ul className="space-y-1 text-sm">
          {items.slice(0, 5).map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2">
              <span className="truncate">{a.summary ?? "Ação"}</span>
              <Badge variant="outline">{a.status ?? "pending"}</Badge>
            </li>
          ))}
        </ul>
      }
    </WidgetContainer>
  );
}

// ── Action Center summary ───────────────────────────────────────────────
export function ActionCenterWidget() {
  return (
    <WidgetContainer title="Action Center" subtitle="Fluxo suggested → executed">
      <p className="text-sm text-muted-foreground">Aprove ou rejeite ações do Copilot no Action Center.</p>
    </WidgetContainer>
  );
}

export const WIDGET_REGISTRY = {
  "executive-score": { label: "Executive Score", component: ExecutiveScoreWidget },
  "recommendations": { label: "Recomendações", component: RecommendationsWidget },
  "insights": { label: "Insights", component: InsightsWidget },
  "signals": { label: "Sinais", component: SignalsWidget },
  "timeline": { label: "Timeline", component: TimelineWidget },
  "forecast": { label: "Forecast", component: ForecastWidget },
  "business-dna": { label: "Business DNA", component: BusinessDNAWidget },
  "memory": { label: "Memória", component: MemoryWidget },
  "consensus": { label: "Consensus", component: ConsensusWidget },
  "learning": { label: "Learning", component: LearningWidget },
  "notifications": { label: "Notificações", component: NotificationsWidget },
  "action-center": { label: "Action Center", component: ActionCenterWidget },
} as const;

export type WidgetId = keyof typeof WIDGET_REGISTRY;
