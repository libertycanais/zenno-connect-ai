// PX 1.2 — Auth two-column shell. Presentational only.
import type { ReactNode } from "react";
import { AuthShowcase } from "./AuthShowcase";
import { ZennoMark } from "@/components/brand/ZennoMark";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-dvh bg-background text-foreground overflow-hidden">
      {/* Global ambient (visible mainly on mobile where showcase is hidden) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-20">
        <div className="absolute inset-0 zenno-ambient opacity-70" />
        <div className="absolute inset-0 zenno-grid-bg opacity-[0.18]" />
      </div>

      <div className="grid min-h-dvh lg:grid-cols-[1.05fr_minmax(0,0.95fr)] xl:grid-cols-[1.1fr_minmax(0,520px)]">
        <AuthShowcase />

        <section className="relative flex flex-col">
          {/* Mobile brand header */}
          <header className="flex items-center gap-2 px-6 pt-6 lg:hidden">
            <ZennoMark className="h-7 w-7" />
            <span className="zenno-wordmark text-[13px]">ZENNO</span>
          </header>

          <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
            <div className="w-full max-w-md zenno-fade-up">
              <div className="zenno-glass rounded-2xl border border-border/60 shadow-[var(--zenno-elev-3)] p-7 sm:p-9">
                {children}
              </div>
              <p className="mt-6 text-center text-[11px] text-muted-foreground">
                Protegido por criptografia AES-256-GCM · Auditoria contínua · Multi-tenant RLS
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
