// PX 1.0 — Resumo Executivo narrado (storytelling)
import { Sparkles, Clock } from "lucide-react";

type Props = {
  opportunities?: number;
  risks?: number;
  revenuePotential?: string;
  estimatedMinutes?: number;
};

export function ExecutiveSummary({
  opportunities = 3, risks = 2, revenuePotential = "R$ 27.000", estimatedMinutes = 18,
}: Props) {
  return (
    <section
      aria-labelledby="exec-summary-title"
      className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl p-6 md:p-7 mb-6 zenno-fade-up"
    >
      <div className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-accent/15 blur-3xl" />
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px] text-accent-foreground">
          <Sparkles size={11} /> Resumo Executivo
        </span>
        <span className="text-[10px] text-muted-foreground">gerado por Executive Expert · Claude</span>
      </div>
      <h2 id="exec-summary-title" className="sr-only">Resumo executivo do dia</h2>
      <p className="text-[15px] leading-relaxed text-foreground/90 max-w-3xl">
        Hoje a IA identificou uma <strong className="text-foreground">redução de desempenho</strong> em campanhas Meta Ads
        e detectou <strong className="text-foreground">{opportunities} oportunidades</strong> de crescimento,
        com <strong className="text-foreground">{risks} riscos</strong> monitorados. Existe potencial adicional estimado em{" "}
        <strong className="text-foreground">{revenuePotential}</strong> se as recomendações prioritárias forem executadas.
      </p>
      <p className="mt-3 inline-flex items-center gap-2 text-[12px] text-muted-foreground">
        <Clock size={12} /> Tempo estimado de execução: <strong className="text-foreground">{estimatedMinutes} minutos</strong>.
      </p>
    </section>
  );
}
