// PX 1.1 — Mission Control · executive command panel
import { Activity, Building2, Cpu, DollarSign, Gauge, HeartPulse, LineChart, Radio, Users } from "lucide-react";
import { AnimatedNumber } from "./AnimatedNumber";

function Cell({ icon, label, value, tone = "default", hint }: {
  icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string;
  tone?: "default" | "ok" | "ai" | "warn";
}) {
  const toneText = tone === "ok" ? "text-emerald-300"
    : tone === "ai" ? "text-accent-foreground"
    : tone === "warn" ? "text-amber-300"
    : "text-foreground";
  return (
    <div className="group relative flex flex-col gap-1 rounded-xl border border-border/40 bg-card/40 px-3 py-2.5 transition hover:border-primary/40 hover:bg-card/70">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        <span className="text-foreground/70">{icon}</span>{label}
      </div>
      <div className={"text-sm font-semibold " + toneText}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground/80">{hint}</div>}
    </div>
  );
}

export function MissionControlPanel({ companyName = "Zenno Enterprise" }: { companyName?: string }) {
  return (
    <section
      aria-label="Mission Control"
      className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-card/70 to-card/40 backdrop-blur-xl px-4 py-3 md:px-5 md:py-4 mb-6 zenno-fade-up"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      <div className="pointer-events-none absolute -right-24 -top-16 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />

      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/15 text-primary">
            <Radio size={14} className="zenno-pulse-dot" />
          </span>
          <div className="leading-tight">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Mission Control</p>
            <p className="text-sm font-semibold text-foreground">{companyName}</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 zenno-pulse-dot" /> Online
          </span>
          <span>Última análise · 18s atrás</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Cell icon={<Building2 size={12} />} label="Empresa" value={companyName} hint="Workspace ativo" />
        <Cell icon={<HeartPulse size={12} />} label="Health" tone="ok" value={<AnimatedNumber value={96} />} hint="Excellent" />
        <Cell icon={<Cpu size={12} />} label="AI Status" tone="ai" value="Working" hint="Claude · 97%" />
        <Cell icon={<Users size={12} />} label="Experts Online" tone="ai" value="7 / 7" hint="Marketing · Finance · Exec…" />
        <Cell icon={<Activity size={12} />} label="Latência IA" value="1.2s" hint="p95 · últimos 30 min" />

        <Cell icon={<DollarSign size={12} />} label="Receita" tone="ok" value={<>R$ <AnimatedNumber value={128400} /></>} hint="7d · +18.2%" />
        <Cell icon={<Gauge size={12} />} label="ROI" tone="ok" value="3.4×" hint="mês corrente" />
        <Cell icon={<LineChart size={12} />} label="Forecast" value="+12.4%" hint="30d · confiança 0.88" />
        <Cell icon={<Cpu size={12} />} label="Modelo ativo" value="Claude Enterprise" hint="fallback OpenAI" />
        <Cell icon={<Radio size={12} />} label="Sinais" value="12 ativos" hint="3 críticos · 9 informativos" />
      </div>
    </section>
  );
}
