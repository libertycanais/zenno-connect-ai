// PX 1.1 — Live Intelligence Feed · ambient non-blocking notifications
import { useEffect, useState } from "react";
import { Sparkles, TrendingUp, AlertTriangle, CheckCircle2, LineChart, Brain, Radio } from "lucide-react";

type FeedItem = {
  id: string;
  icon: React.ReactNode;
  title: string;
  detail?: string;
  tone: "ai" | "ok" | "warn" | "info";
};

const CATALOG: Omit<FeedItem, "id">[] = [
  { icon: <Sparkles size={14} />, title: "Marketing Expert concluiu análise", detail: "Campanha Meta · CPA -12%", tone: "ai" },
  { icon: <LineChart size={14} />, title: "Forecast atualizado", detail: "Receita +R$ 84k projetados", tone: "ok" },
  { icon: <AlertTriangle size={14} />, title: "Finance Expert encontrou risco", detail: "Fluxo de caixa · 14d", tone: "warn" },
  { icon: <CheckCircle2 size={14} />, title: "Tracking sincronizado", detail: "GA4 · Meta CAPI · Ads", tone: "ok" },
  { icon: <Brain size={14} />, title: "Executive AI publicou relatório", detail: "Weekly Executive Brief", tone: "ai" },
  { icon: <TrendingUp size={14} />, title: "Nova oportunidade detectada", detail: "Segmento LTV alto · +38%", tone: "info" },
  { icon: <Radio size={14} />, title: "Google Ads atualizado", detail: "3 grupos otimizados", tone: "info" },
];

const toneMap: Record<FeedItem["tone"], string> = {
  ai:   "border-accent/35 bg-accent/10 text-accent-foreground",
  ok:   "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  warn: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  info: "border-primary/30 bg-primary/10 text-primary",
};

export function LiveIntelligenceFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let cursor = 0;
    const push = () => {
      const seed = CATALOG[cursor % CATALOG.length]!;
      cursor += 1;
      const id = `${Date.now()}-${cursor}`;
      setItems((prev) => [...prev.slice(-3), { ...seed, id }]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((i) => i.id !== id));
      }, 5200);
    };
    const first = window.setTimeout(push, 3200);
    const interval = window.setInterval(push, 7800);
    return () => { window.clearTimeout(first); window.clearInterval(interval); };
  }, []);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-4 right-4 z-40 flex w-[320px] flex-col gap-2"
    >
      {items.map((it) => (
        <div
          key={it.id}
          role="status"
          className={"zenno-feed-in pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3 py-2.5 backdrop-blur-xl shadow-[0_10px_40px_-16px_oklch(0_0_0/0.7)] " + toneMap[it.tone]}
        >
          <span className="mt-0.5 shrink-0">{it.icon}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium text-foreground truncate">{it.title}</p>
            {it.detail && <p className="text-[11px] text-muted-foreground truncate">{it.detail}</p>}
          </div>
          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-current zenno-pulse-dot" />
        </div>
      ))}
    </div>
  );
}
