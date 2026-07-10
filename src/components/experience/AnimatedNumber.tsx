// PX 1.1 — Animated numeric counter (respects reduced-motion)
import { useEffect, useRef, useState } from "react";

export function AnimatedNumber({
  value,
  duration = 900,
  format,
}: { value: number; duration?: number; format?: (n: number) => string }) {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") { setDisplay(value); return; }
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { setDisplay(value); from.current = value; return; }
    const start = performance.now();
    const initial = from.current;
    const delta = value - initial;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(initial + delta * eased);
      if (t < 1) raf.current = requestAnimationFrame(step);
      else from.current = value;
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [value, duration]);

  return <span className="tabular-nums">{format ? format(display) : Math.round(display).toLocaleString("pt-BR")}</span>;
}
