// FEATURE — First Five Minutes · "Powered by Zenno Intelligence" badge (additive)
// Small, low-contrast marker. Marca reforçada em toda análise executiva.
import { Sparkles } from "lucide-react";

type Props = { className?: string };

export function PoweredByZennoBadge({ className = "" }: Props) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70 ${className}`}
      aria-label="Powered by Zenno Intelligence"
    >
      <Sparkles size={10} className="opacity-70" />
      <span>Powered by Zenno Intelligence</span>
    </div>
  );
}
