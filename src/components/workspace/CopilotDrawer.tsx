// EPIC K.2 — CopilotDrawer (lateral)
// Reuses existing AI Copilot conversation domain via server functions.

import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listCopilotConversations } from "@/lib/copilot.functions";

export function CopilotDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const list = useServerFn(listCopilotConversations);
  const [tab, setTab] = useState<"conv" | "trace" | "ctx">("conv");

  const { data, isLoading } = useQuery({
    queryKey: ["copilot", "conversations"],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => list({ data: {} as any }).catch(() => ({ conversations: [] as any[] })),
    enabled: open,
    staleTime: 30_000,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col bg-card/95 backdrop-blur-xl border-border/60">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent shadow-[0_0_24px_-6px_oklch(0.72_0.18_235/0.6)]">
              <span className="text-sm">✨</span>
            </span>
            <span className="zenno-gradient-text text-base font-semibold">Zenno AI</span>
            <Badge variant="outline" className="ml-1 border-primary/40 text-primary">Runtime</Badge>
          </SheetTitle>
          <SheetDescription className="text-xs">Contexto, memória e transparência das decisões.</SheetDescription>
        </SheetHeader>

        {/* Live analysis panel */}
        <div className="mt-4 rounded-lg border border-border/60 bg-background/40 p-3">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-2">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 zenno-pulse-dot" />
              Analisando empresa…
            </span>
            <span>há 18s</span>
          </div>
          {[
            { label: "Marketing", pct: 92 },
            { label: "Financeiro", pct: 78 },
            { label: "CRM", pct: 85 },
            { label: "Executive", pct: 97 },
          ].map((r) => (
            <div key={r.label} className="mb-2 last:mb-0">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>{r.label}</span><span className="tabular-nums">{r.pct}%</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-secondary/50 overflow-hidden relative">
                <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-accent rounded-full" style={{ width: `${r.pct}%` }} />
                <div className="absolute inset-0 zenno-shimmer opacity-60" />
              </div>
            </div>
          ))}
          <div className="mt-3 pt-2 border-t border-border/40 flex justify-between text-[10px] text-muted-foreground">
            <span>Modelo: <strong className="text-foreground">Claude</strong></span>
            <span>Confiança: <strong className="text-primary">97%</strong></span>
          </div>
        </div>

        <div className="mt-4 flex gap-1 border-b border-border/60">
          {(["conv", "trace", "ctx"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={
                "px-3 py-2 text-xs font-medium border-b-2 transition " +
                (tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {t === "conv" ? "Conversas" : t === "trace" ? "Decision Trace" : "Contexto"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto mt-3 space-y-2 text-sm">
          {tab === "conv" && (
            <>
              {isLoading && <Skeleton className="h-16 w-full" />}
              {!isLoading && (data?.conversations ?? []).length === 0 && (
                <div className="rounded-lg border border-dashed border-border/60 p-4 text-center">
                  <p className="text-xs text-muted-foreground">Nenhuma conversa ainda.</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-1">Peça uma análise ao Copilot para começar.</p>
                </div>
              )}
              {(data?.conversations ?? []).map((c: { id: string; title?: string | null; updated_at?: string }) => (
                <div key={c.id} className="rounded-md border border-border/60 p-3 hover:bg-secondary/40 transition">
                  <p className="font-medium text-sm truncate">{c.title ?? "Sem título"}</p>
                  <p className="text-xs text-muted-foreground">{c.updated_at ?? ""}</p>
                </div>
              ))}
            </>
          )}
          {tab === "trace" && (
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>Cada resposta expõe: <strong className="text-foreground">Expert</strong>, <strong className="text-foreground">Modelo</strong>, <strong className="text-foreground">Provider</strong> e <strong className="text-foreground">Confidence</strong>.</p>
              <p>Rastreabilidade via Governance Layer (Rule Registry + Artifact Lineage).</p>
            </div>
          )}
          {tab === "ctx" && (
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>Contexto assembly usa Business DNA + Memory Engine + Signals recentes.</p>
              <p>Snapshot de contexto por request armazenado para replay.</p>
            </div>
          )}
        </div>

        <div className="mt-3 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Fechar</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
