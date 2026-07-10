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
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Zenno Copilot
            <Badge variant="outline">Runtime</Badge>
          </SheetTitle>
          <SheetDescription>Contexto, memória e transparência das decisões.</SheetDescription>
        </SheetHeader>

        <div className="mt-3 flex gap-1 border-b border-border/60">
          {(["conv", "trace", "ctx"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={
                "px-3 py-2 text-xs font-medium border-b-2 " +
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
                <p className="text-muted-foreground text-xs">Nenhuma conversa ainda. Inicie uma pelo Copiloto.</p>
              )}
              {(data?.conversations ?? []).map((c: { id: string; title?: string | null; updated_at?: string }) => (
                <div key={c.id} className="rounded-md border border-border/60 p-3 hover:bg-muted/40 transition">
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
