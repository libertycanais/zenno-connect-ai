// PX 1.0 — Experts Panel (barras animadas mostrando trabalho contínuo)
type Expert = { name: string; task: string; progress: number };

const EXPERTS: Expert[] = [
  { name: "Marketing Expert", task: "Analisando campanhas", progress: 92 },
  { name: "Finance Expert", task: "Calculando forecast", progress: 74 },
  { name: "Sales Expert", task: "Revisando pipeline", progress: 61 },
  { name: "Executive Expert", task: "Gerando insights", progress: 88 },
];

export function ExpertsPanel() {
  return (
    <section aria-labelledby="experts-title" className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl p-5 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 id="experts-title" className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent zenno-pulse-dot" aria-hidden />
          Experts em execução
        </h3>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">tempo real</span>
      </div>
      <ul className="space-y-4">
        {EXPERTS.map((e) => (
          <li key={e.name}>
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
              <span className="text-[13px] text-foreground font-medium">{e.name}</span>
              <span className="text-[11px] text-muted-foreground">{e.task}</span>
            </div>
            <div className="relative h-2 rounded-full bg-secondary/40 overflow-hidden" aria-hidden>
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all"
                style={{ width: `${e.progress}%` }}
              />
              <div className="absolute inset-0 zenno-shimmer opacity-40" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function EmptyStateNoRecommendations() {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/40 p-8 text-center">
      <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-emerald-500/15 border border-emerald-500/30 grid place-items-center text-emerald-300">✓</div>
      <p className="text-sm text-foreground font-medium">Nenhuma recomendação pendente.</p>
      <p className="mt-1 text-[12px] text-muted-foreground max-w-md mx-auto">
        Excelente. Os Experts continuam monitorando sua empresa 24/7 e você será avisado assim que surgirem novas oportunidades.
      </p>
    </div>
  );
}
