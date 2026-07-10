// FEATURE — Marketing Intelligence Experience · Command Center card
// Invisible UI. Tipografia como interface. Sem gráficos.
import type { MarketingIntelligenceSnapshot } from "@/lib/marketing/intelligence";

type Props = { snapshot: MarketingIntelligenceSnapshot | null };

function fmtDelta(d: number): string {
  if (!d) return "estável";
  const sign = d > 0 ? "↑" : "↓";
  return `${sign} ${Math.abs(d).toFixed(1)} esta semana`;
}

function fmtTime(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function MarketingIntelligenceCard({ snapshot }: Props) {
  const score = snapshot?.score.score ?? null;
  const grade = snapshot?.score.grade ?? "Foundational";
  const opps = snapshot?.opportunitiesCount ?? 0;
  const risks = snapshot?.risksCount ?? 0;

  return (
    <article>
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground/80 mb-3">
        Marketing Intelligence
      </div>
      <div className="flex items-baseline gap-3">
        <div className="text-5xl font-medium tabular-nums text-foreground leading-none">
          {score ?? "—"}
        </div>
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground/80">
          {grade} Grade
        </div>
      </div>
      <div className="mt-2 text-[12px] text-muted-foreground">
        {snapshot ? fmtDelta(snapshot.weeklyDelta) : "aguardando primeira sincronização"}
      </div>
      <p className="mt-4 text-[13px] text-muted-foreground leading-relaxed">
        {opps} oportunidade{opps === 1 ? "" : "s"} · {risks} risco{risks === 1 ? "" : "s"}
      </p>
      <p className="mt-1 text-[12px] text-muted-foreground/70">
        Última análise · {fmtTime(snapshot?.lastAnalysisAt)}
      </p>
    </article>
  );
}