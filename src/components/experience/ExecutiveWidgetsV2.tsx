// PX 1.1 — Executive Widgets V2 · premium KPI panels with sparkline + live indicator
import { useMemo } from "react";
import { DollarSign, HeartPulse, Cpu, LineChart } from "lucide-react";
import { AnimatedNumber } from "./AnimatedNumber";

type Tone = "primary" | "ok" | "ai" | "warn";
const toneRing: Record<Tone, string> = {
  primary: "from-primary/20 via-primary/5 to-transparent border-primary/25",
  ok: "from-emerald-500/20 via-emerald-500/5 to-transparent border-emerald-500/25",
  ai: "from-accent/25 via-accent/5 to-transparent border-accent/30",
  warn: "from-amber-500/20 via-amber-500/5 to-transparent border-amber-500/25",
};

function Sparkline({ points, tone = "primary" }: { points: number[]; tone?: Tone }) {
  const { d, area } = useMemo(() => {
    if (!points.length) return { d: "", area: "" };
    const min = Math.min(...points), max = Math.max(...points);
    const span = Math.max(1, max - min);
    const W = 120, H = 32;
    const step = W / (points.length - 1 || 1);
    const coords = points.map((v, i) => `${i * step},${H - ((v - min) / span) * H}`);
    return { d: "M" + coords.join(" L "), area: "M0," + H + " L" + coords.join(" L ") + ` L${W},${H} Z` };
  }, [points]);
  const stroke = tone === "ok" ? "oklch(0.78 0.16 155)"
    : tone === "warn" ? "oklch(0.82 0.16 75)"
    : tone === "ai" ? "oklch(0.72 0.19 295)"
    : "oklch(0.72 0.18 235)";
  return (
    <svg viewBox="0 0 120 32" className="h-8 w-full overflow-visible">
      <defs>
        <linearGradient id={`sg-${tone}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg-${tone})`} />
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Widget({
  icon, label, value, delta, status, tone, points,
}: {
  icon: React.ReactNode; label: string; value: React.ReactNode; delta?: string;
  status: string; tone: Tone; points: number[];
}) {
  return (
    <div className={"group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-4 md:p-5 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_50px_-20px_oklch(0.72_0.18_235/0.45)] " + toneRing[tone]}>
      <div className="pointer-events-none absolute inset-x-0 -top-8 h-16 bg-gradient-to-b from-white/[0.05] to-transparent" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          <span className="text-foreground/80">{icon}</span>{label}
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 zenno-pulse-dot" />live
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="text-2xl md:text-3xl font-semibold text-foreground">{value}</div>
        {delta && <span className="text-[11px] font-medium text-emerald-300">{delta}</span>}
      </div>
      <div className="mt-2"><Sparkline points={points} tone={tone} /></div>
      <div className="mt-1 text-[11px] text-muted-foreground">{status}</div>
    </div>
  );
}

export function ExecutiveWidgetsV2() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4 zenno-fade-up">
      <Widget
        icon={<DollarSign size={14} />} label="Revenue" tone="primary"
        value={<><span className="text-muted-foreground text-lg mr-1">R$</span><AnimatedNumber value={128400} /></>}
        delta="+18.2%" status="7 dias · vs semana anterior"
        points={[42, 48, 46, 55, 60, 58, 68, 74, 72, 84, 92, 96]}
      />
      <Widget
        icon={<HeartPulse size={14} />} label="Health" tone="ok"
        value={<AnimatedNumber value={96} />}
        delta="Excellent" status="Adoção · Uso · Satisfação"
        points={[80, 82, 84, 83, 86, 88, 90, 92, 93, 95, 96, 96]}
      />
      <Widget
        icon={<Cpu size={14} />} label="AI Runtime" tone="ai"
        value={<><span className="text-foreground">Working</span></>}
        delta="7 Experts" status="Claude · latência 1.2s · 97%"
        points={[65, 72, 68, 78, 82, 76, 88, 92, 90, 94, 91, 97]}
      />
      <Widget
        icon={<LineChart size={14} />} label="Forecast" tone="primary"
        value={<><span className="text-foreground">Updated</span></>}
        delta="+12.4%" status="Horizonte 30d · confiança 0.88"
        points={[30, 34, 38, 42, 40, 48, 52, 58, 62, 68, 74, 82]}
      />
    </div>
  );
}
