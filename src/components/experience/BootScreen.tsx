// PX 1.0 — Boot Experience · Refreshed for PX 1.2 Brand Identity
// Cinematic post-login boot overlay. 100% client-side, no backend calls.
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { ZennoMark } from "@/components/brand/ZennoMark";

const MODULES = [
  "Workspace", "CRM", "Executive AI", "Marketing AI", "Finance AI",
  "Experts", "Analytics", "Claude", "Monitoring", "Memory Engine",
] as const;

export const BOOT_FLAG = "zenno.boot.pending";

export function triggerBoot() {
  try { sessionStorage.setItem(BOOT_FLAG, "1"); } catch { /* ignore */ }
}

export function BootScreen({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const name = (user?.email ?? "").split("@")[0] || "Operador";
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<"boot" | "welcome" | "exit">("boot");

  useEffect(() => {
    const reduced = typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { onDone(); return; }

    const tickMs = 130;
    const timers: number[] = [];
    MODULES.forEach((_, i) => {
      timers.push(window.setTimeout(() => setStep(i + 1), tickMs * (i + 1)));
    });
    timers.push(window.setTimeout(() => setPhase("welcome"), tickMs * MODULES.length + 300));
    timers.push(window.setTimeout(() => setPhase("exit"), tickMs * MODULES.length + 1400));
    timers.push(window.setTimeout(() => onDone(), tickMs * MODULES.length + 1900));
    return () => timers.forEach((t) => clearTimeout(t));
  }, [onDone]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={
        "fixed inset-0 z-[100] flex items-center justify-center bg-background transition-opacity duration-500 " +
        (phase === "exit" ? "opacity-0 pointer-events-none" : "opacity-100")
      }
    >
      <div className="pointer-events-none absolute inset-0 zenno-ambient opacity-90" aria-hidden />
      <div className="pointer-events-none absolute inset-0 opacity-30" aria-hidden
        style={{ background: "radial-gradient(600px 400px at 50% 40%, oklch(0.72 0.18 235 / 0.35), transparent 65%)" }} />

      <div className="relative w-full max-w-md px-8 text-center">
        <div className="mx-auto mb-6 relative flex items-center justify-center">
          <div className="absolute inset-0 mx-auto h-24 w-24 rounded-full bg-primary/25 blur-2xl zenno-pulse-dot" aria-hidden />
          <ZennoMark className="relative h-24 w-24 drop-shadow-[0_0_28px_oklch(0.72_0.18_235/0.55)]" />
        </div>

        <h1 className="text-3xl font-semibold tracking-[0.28em] zenno-gradient-text">ZENNO</h1>
        <p className="mt-1 text-[11px] uppercase tracking-[0.32em] text-primary/80">
          Enterprise Intelligence OS
        </p>
        <p className="mt-1 text-[10px] uppercase tracking-[0.34em] text-muted-foreground/70">
          Powered by Zenno AI
        </p>


        {phase === "boot" && (
          <>
            <p className="mt-6 text-sm text-muted-foreground">Inicializando módulos…</p>
            <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-1.5 text-left">
              {MODULES.map((m, i) => (
                <li key={m} className="flex items-center gap-2 text-[13px] text-foreground/90">
                  <span
                    className={
                      "inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] transition-all " +
                      (i < step
                        ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-300"
                        : "border-border/60 text-muted-foreground/60")
                    }
                    aria-hidden
                  >
                    {i < step ? "✓" : ""}
                  </span>
                  <span className={i < step ? "opacity-100" : "opacity-50"}>{m}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 h-1 rounded-full bg-secondary/50 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent transition-[width] duration-200"
                style={{ width: `${(step / MODULES.length) * 100}%` }}
              />
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">Sincronizando inteligência…</p>
          </>
        )}

        {phase !== "boot" && (
          <div className="mt-8 zenno-fade-up">
            <p className="text-lg text-foreground">
              Bem-vindo, <span className="zenno-gradient-text capitalize font-semibold">{name}</span>.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Abrindo Command Center…</p>
          </div>
        )}
      </div>
    </div>
  );
}
