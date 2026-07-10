// PX 1.2 — Auth Showcase (left column)
// Presentational only. No auth logic, no contracts touched.
import { Activity, Brain, ShieldCheck, Sparkles } from "lucide-react";
import { ZennoMark } from "@/components/brand/ZennoMark";

const benefits = [
  { icon: Brain, title: "Copilot multi-expert", desc: "Marketing, Finance, Forecast e Memory operando em tempo real." },
  { icon: Activity, title: "Autonomous monitoring", desc: "Sinais, anomalias e insights entregues antes do problema." },
  { icon: ShieldCheck, title: "Enterprise-grade security", desc: "RLS multi-tenant, AES-256-GCM e auditoria contínua." },
];

const liveSignals = [
  { label: "Claude reasoning", value: "1.2k tokens/s", tone: "primary" as const },
  { label: "Forecast Expert", value: "confiança 94%", tone: "accent" as const },
  { label: "Memory Engine", value: "382 decisões indexadas", tone: "primary" as const },
];

export function AuthShowcase() {
  return (
    <aside
      className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 xl:p-16"
      aria-label="Zenno — Enterprise Intelligence OS"
    >
      {/* Ambient background — reuses PX 1.1 tokens */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 zenno-ambient opacity-90" />
        <div className="absolute inset-0 zenno-grid-bg opacity-[0.28]" />
        <div className="absolute -top-40 -left-24 h-[480px] w-[480px] rounded-full bg-primary/20 blur-3xl zenno-orb" />
        <div className="absolute bottom-[-160px] right-[-120px] h-[520px] w-[520px] rounded-full bg-accent/18 blur-3xl zenno-orb-slow" />
        <div className="absolute inset-0 zenno-noise opacity-40" />
      </div>

      {/* Brand */}
      <header className="flex items-center gap-3">
        <ZennoMark className="h-10 w-10" />
        <div className="leading-tight">
          <div className="zenno-wordmark text-[15px]">ZENNO</div>
          <div className="text-xs text-muted-foreground tracking-wide">Enterprise Intelligence OS</div>
        </div>
      </header>

      {/* Value message */}
      <div className="max-w-xl zenno-fade-up">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary zenno-pulse-dot" />
          AI Runtime online
        </div>
        <h1 className="mt-6 text-4xl xl:text-5xl font-semibold leading-[1.05] tracking-tight">
          O sistema operacional <span className="zenno-gradient-text">de inteligência</span> para operações enterprise.
        </h1>
        <p className="mt-5 text-base text-muted-foreground max-w-lg">
          Zenno unifica Copilot, decisões, memória organizacional e execução em um único plano de controle — vivo,
          auditável e cinematográfico.
        </p>

        {/* Live signals */}
        <div className="mt-8 zenno-glass rounded-xl p-4 space-y-3" role="status" aria-live="polite">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <span className="flex items-center gap-2">
              <Sparkles size={12} className="text-primary" /> Live intelligence
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 zenno-pulse-dot" />
              streaming
            </span>
          </div>
          <ul className="space-y-2.5">
            {liveSignals.map((s) => (
              <li key={s.label} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-foreground/90">
                  <span
                    className={
                      "h-1.5 w-1.5 rounded-full zenno-pulse-dot " +
                      (s.tone === "primary" ? "bg-primary" : "bg-accent")
                    }
                  />
                  {s.label}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">{s.value}</span>
              </li>
            ))}
            <li className="pt-1">
              <div className="zenno-progress-track h-1 rounded-full">
                <div className="zenno-progress-indeterminate h-full rounded-full" />
              </div>
            </li>
          </ul>
        </div>
      </div>

      {/* Benefits */}
      <div className="grid grid-cols-1 gap-3 max-w-xl">
        {benefits.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="group flex items-start gap-3 rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm p-4 transition-colors hover:border-primary/40"
          >
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/20">
              <Icon size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">{title}</div>
              <div className="text-xs text-muted-foreground">{desc}</div>
            </div>
          </div>
        ))}
      </div>

      <footer className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>© {new Date().getFullYear()} Zenno · Enterprise Intelligence OS</span>
        <span className="tabular-nums">v1.0 · RC2 Pilot</span>
      </footer>
    </aside>
  );
}
