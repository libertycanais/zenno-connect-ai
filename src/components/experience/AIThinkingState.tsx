// PX 1.1 — AI Thinking State · cinematic replacement for spinner
import { useEffect, useState } from "react";
import { Brain, Sparkles, Calculator, TrendingUp, ShieldCheck } from "lucide-react";

type Phase = { expert: string; action: string; icon: React.ReactNode; ms: number };

const DEFAULT_PHASES: Phase[] = [
  { expert: "Claude Enterprise",  action: "Reasoning about context…",       icon: <Brain size={14} />,        ms: 1600 },
  { expert: "Marketing Expert",   action: "Searching evidence…",            icon: <Sparkles size={14} />,     ms: 1500 },
  { expert: "Finance Expert",     action: "Calculating financial impact…",  icon: <Calculator size={14} />,   ms: 1500 },
  { expert: "Forecast Expert",    action: "Projecting scenarios…",          icon: <TrendingUp size={14} />,   ms: 1400 },
  { expert: "Executive Expert",   action: "Building recommendation…",       icon: <ShieldCheck size={14} />,  ms: 1400 },
];

export function AIThinkingState({ label = "Zenno está pensando", phases = DEFAULT_PHASES, compact = false }: {
  label?: string; phases?: Phase[]; compact?: boolean;
}) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => setI((n) => (n + 1) % phases.length), phases[i]!.ms);
    return () => window.clearTimeout(t);
  }, [i, phases]);

  const p = phases[i]!;
  return (
    <div className={"flex items-center gap-3 rounded-xl border border-accent/25 bg-accent/[0.06] backdrop-blur-xl " + (compact ? "px-3 py-2" : "px-4 py-3")}>
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent-foreground">
        {p.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[12px] font-medium text-foreground truncate">{p.expert}</p>
          <span className="text-[10px] text-muted-foreground">{label}</span>
        </div>
        <p className="text-[11px] text-muted-foreground truncate">{p.action}</p>
        <div className="mt-1.5 h-1 w-full rounded-full zenno-progress-track">
          <div className="zenno-progress-indeterminate rounded-full" />
        </div>
      </div>
      <div className="flex items-center gap-1" aria-hidden>
        <span className="h-1.5 w-1.5 rounded-full bg-accent-foreground/70 zenno-dot-blink" />
        <span className="h-1.5 w-1.5 rounded-full bg-accent-foreground/70 zenno-dot-blink" />
        <span className="h-1.5 w-1.5 rounded-full bg-accent-foreground/70 zenno-dot-blink" />
      </div>
    </div>
  );
}
