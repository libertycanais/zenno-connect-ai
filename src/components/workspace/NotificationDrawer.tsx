// EPIC K.2 — NotificationDrawer
// Lists pending copilot actions as notifications (approve/reject in Action Center).

import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { listPendingActions } from "@/lib/copilot.functions";

export function NotificationDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const list = useServerFn(listPendingActions);
  const { data, isLoading } = useQuery({
    queryKey: ["notifications", "pending"],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => list({ data: {} as any }).catch(() => ({ actions: [] as any[] })),
    enabled: open,
    staleTime: 15_000,
  });

  const actions = (data?.actions ?? []) as Array<{
    id: string; action_type?: string; summary?: string; created_at?: string; status?: string;
  }>;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Notificações</SheetTitle>
          <SheetDescription>Ações pendentes do Copilot & sinais recentes.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-2 overflow-y-auto">
          {isLoading && <Skeleton className="h-16 w-full" />}
          {!isLoading && actions.length === 0 && (
            <p className="text-xs text-muted-foreground py-8 text-center">Sem notificações no momento.</p>
          )}
          {actions.map((a) => (
            <div key={a.id} className="rounded-md border border-border/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{a.summary ?? a.action_type ?? "Ação"}</p>
                  <p className="text-xs text-muted-foreground">{a.created_at ?? ""}</p>
                </div>
                <Badge variant="outline" className="shrink-0">{a.status ?? "pending"}</Badge>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
