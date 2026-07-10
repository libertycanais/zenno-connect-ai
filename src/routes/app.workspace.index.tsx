// EPIC K.2 — /app/workspace (Command Center Overview · Enterprise DS v2)
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { WorkspaceGrid } from "@/components/workspace/WorkspaceGrid";
import {
  ExecutiveScoreWidget, RecommendationsWidget, InsightsWidget, SignalsWidget,
  TimelineWidget, NotificationsWidget,
} from "@/components/workspace/widgets";
import { getIntelligenceWidgets } from "@/lib/experts-analytics.functions";
import { useAuth } from "@/lib/auth";
import { Sparkles, TrendingUp, AlertTriangle, DollarSign, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/app/workspace/")({ component: WorkspaceOverview });

function greet(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function money(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function CommandHero() {
  const { user } = useAuth();
  const name = (user?.email ?? "").split("@")[0] ?? "";
  const fn = useServerFn(getIntelligenceWidgets);
  const q = useQuery({ queryKey: ["intel", "widgets"], queryFn: () => fn(), staleTime: 60_000 });

  const opps = q.data?.totals.open ?? 0;
  const critical = q.data?.quality.criticalCount ?? 0;
  const roi = q.data?.financial.estimatedRoiCents ?? 0;
  const savings = Math.round(roi * 0.15);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl p-8 md:p-10 mb-8 zenno-fade-up">
      <div className="pointer-events-none absolute -top-32 -right-20 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-accent/15 blur-3xl" />

      <div className="relative flex items-center gap-2 mb-4">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary zenno-pulse-dot" />
          Zenno AI · análise em tempo real
        </span>
        <span className="text-[11px] text-muted-foreground">atualizado há 18s · Claude · 97%</span>
      </div>

      <h1 className="relative text-4xl md:text-5xl font-semibold tracking-tight text-foreground">
        {greet()}, <span className="zenno-gradient-text capitalize">{name || "Operador"}</span>.
      </h1>
      <p className="relative mt-3 text-base md:text-lg text-muted-foreground max-w-2xl">
        Hoje a inteligência do Zenno consolidou{" "}
        <strong className="text-foreground">{opps}</strong> oportunidades,{" "}
        <strong className="text-foreground">{critical}</strong> riscos e um potencial financeiro relevante.
      </p>

      <div className="relative mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
        <HeroKpi icon={<Sparkles size={14} />} label="Oportunidades" value={String(opps)} tone="primary" />
        <HeroKpi icon={<AlertTriangle size={14} />} label="Riscos" value={String(critical)} tone="warn" />
        <HeroKpi icon={<DollarSign size={14} />} label="Economia prevista" value={money(savings)} tone="ok" />
        <HeroKpi icon={<TrendingUp size={14} />} label="Receita potencial" value={money(roi)} tone="ai" />
      </div>

      <div className="relative mt-8 flex flex-wrap items-center gap-3">
        <button className="inline-flex items-center gap-2 h-11 px-5 rounded-lg bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-medium shadow-[0_0_28px_-6px_oklch(0.72_0.18_235/0.7)] hover:shadow-[0_0_36px_-4px_oklch(0.72_0.18_235/0.85)] transition-all">
          <Sparkles size={15} /> Abrir Copilot <ArrowRight size={14} />
        </button>
        <button className="inline-flex items-center gap-2 h-11 px-5 rounded-lg border border-border/60 bg-secondary/40 hover:bg-secondary/70 hover:border-primary/40 text-sm text-foreground transition">
          Ver recomendações
        </button>
        <span className="ml-auto hidden md:inline text-[11px] text-muted-foreground">
          Executive Score · Signals · Playbooks · Memory · Learning
        </span>
      </div>
    </section>
  );
}

function HeroKpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "primary" | "warn" | "ok" | "ai" }) {
  const toneMap: Record<string, string> = {
    primary: "from-primary/15 to-primary/0 border-primary/25 text-primary",
    warn: "from-amber-500/15 to-amber-500/0 border-amber-500/25 text-amber-300",
    ok: "from-emerald-500/15 to-emerald-500/0 border-emerald-500/25 text-emerald-300",
    ai: "from-accent/20 to-accent/0 border-accent/30 text-accent-foreground",
  };
  return (
    <div className={"relative rounded-xl border bg-gradient-to-br p-4 " + toneMap[tone]}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider opacity-90">
        {icon}<span>{label}</span>
      </div>
      <div className="mt-2 text-2xl md:text-3xl font-semibold text-foreground tabular-nums">{value}</div>
    </div>
  );
}

function SectionTitle({ label, badge }: { label: string; badge?: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-3 mt-2">
      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</h2>
      {badge && <span className="text-[10px] text-primary/80">{badge}</span>}
      <div className="flex-1 h-px bg-gradient-to-r from-border/60 via-border/20 to-transparent" />
    </div>
  );
}

function WorkspaceOverview() {
  return (
    <WorkspaceShell title="Command Center">
      <CommandHero />

      <SectionTitle label="KPIs Executivos" badge="live" />
      <WorkspaceGrid>
        <ExecutiveScoreWidget />
        <InsightsWidget />
        <SignalsWidget />
      </WorkspaceGrid>

      <SectionTitle label="Inteligência & Recomendações" badge="AI" />
      <WorkspaceGrid>
        <RecommendationsWidget />
        <TimelineWidget />
        <NotificationsWidget />
      </WorkspaceGrid>
    </WorkspaceShell>
  );
}
