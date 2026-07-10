// PX 1.0 — AI Status Bar (visual only, sem chamadas de rede)
import { useEffect, useState } from "react";
import { Activity, Cpu, Gauge, Users2, Zap } from "lucide-react";

export function AIStatusBar() {
  const [secs, setSecs] = useState(21);
  useEffect(() => {
    const id = window.setInterval(() => setSecs((s) => (s > 180 ? 3 : s + 1)), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div
      role="status"
      aria-label="Status da inteligência Zenno"
      className="mb-6 flex flex-wrap items-center gap-2.5 rounded-xl border border-border/50 bg-card/60 backdrop-blur-xl px-4 py-2.5 text-[12px]"
    >
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 zenno-pulse-dot" aria-hidden />
        Zenno AI Online
      </span>
      <StatChip icon={<Cpu size={12} />} label="Claude Enterprise" />
      <StatChip icon={<Activity size={12} />} label={`Última análise há ${secs}s`} />
      <StatChip icon={<Users2 size={12} />} label="7 experts ativos" />
      <StatChip icon={<Zap size={12} />} label="182.000 tokens hoje" />
      <StatChip icon={<Gauge size={12} />} label="Confiabilidade 97%" tone="ai" />
    </div>
  );
}

function StatChip({ icon, label, tone }: { icon: React.ReactNode; label: string; tone?: "ai" }) {
  const cls =
    tone === "ai"
      ? "border-primary/30 bg-primary/10 text-primary"
      : "border-border/50 bg-secondary/40 text-muted-foreground";
  return (
    <span className={"inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 " + cls}>
      {icon}<span>{label}</span>
    </span>
  );
}
