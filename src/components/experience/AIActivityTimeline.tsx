// PX 1.0 — AI Activity Timeline (visual, storytelling)
import { Brain, LineChart, MessageCircle, ScrollText, Sparkles } from "lucide-react";

type Item = { time: string; who: string; what: string; icon: React.ReactNode; tone: "ai" | "ok" | "info" };

const ITEMS: Item[] = [
  { time: "09:12", who: "Marketing Expert", what: "iniciou análise de campanhas Meta Ads",
    icon: <LineChart size={13} />, tone: "info" },
  { time: "09:13", who: "Finance Expert", what: "concluiu previsão de fluxo de caixa",
    icon: <Sparkles size={13} />, tone: "ok" },
  { time: "09:14", who: "Executive Expert", what: "publicou relatório executivo",
    icon: <ScrollText size={13} />, tone: "ai" },
  { time: "09:15", who: "Claude", what: "respondeu consulta contextual do Copilot",
    icon: <MessageCircle size={13} />, tone: "ai" },
  { time: "09:16", who: "Memory Engine", what: "atualizou base de conhecimento",
    icon: <Brain size={13} />, tone: "ok" },
];

export function AIActivityTimeline() {
  return (
    <section aria-labelledby="ai-activity-title" className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl p-5 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 id="ai-activity-title" className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-primary zenno-pulse-dot" aria-hidden />
          AI Activity
        </h3>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">últimos minutos</span>
      </div>
      <ol className="relative border-l border-border/40 pl-5 space-y-4">
        {ITEMS.map((it, i) => (
          <li key={i} className="relative zenno-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
            <span
              aria-hidden
              className={
                "absolute -left-[27px] top-1 grid place-items-center h-5 w-5 rounded-full border " +
                (it.tone === "ai"
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : it.tone === "ok"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-secondary/50 border-border/60 text-muted-foreground")
              }
            >
              {it.icon}
            </span>
            <div className="flex items-baseline gap-2">
              <time className="text-[11px] tabular-nums text-muted-foreground">{it.time}</time>
              <span className="text-[13px] text-foreground">
                <strong className="font-medium">{it.who}</strong>{" "}
                <span className="text-muted-foreground">{it.what}</span>
              </span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
