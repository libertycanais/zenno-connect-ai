// EPIC K.2 — /app/workspace/actions (Action Center)
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { WidgetContainer, WidgetLoader, WidgetEmpty, WidgetError } from "@/components/workspace/WorkspaceGrid";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { listPendingActions, approvePendingAction, rejectPendingAction } from "@/lib/copilot.functions";

export const Route = createFileRoute("/app/workspace/actions")({ component: ActionsPage });

function ActionsPage() {
  const listFn = useServerFn(listPendingActions);
  const approveFn = useServerFn(approvePendingAction);
  const rejectFn = useServerFn(rejectPendingAction);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["actions", "pending"],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => listFn({ data: {} as any }),
  });

  const approve = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: (id: string) => approveFn({ data: { actionId: id } as any }),
    onSuccess: () => { toast.success("Ação aprovada"); qc.invalidateQueries({ queryKey: ["actions"] }); qc.invalidateQueries({ queryKey: ["notifications"] }); },
    onError: (e) => toast.error(String(e instanceof Error ? e.message : e)),
  });
  const reject = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: (id: string) => rejectFn({ data: { actionId: id } as any }),
    onSuccess: () => { toast.success("Ação rejeitada"); qc.invalidateQueries({ queryKey: ["actions"] }); qc.invalidateQueries({ queryKey: ["notifications"] }); },
    onError: (e) => toast.error(String(e instanceof Error ? e.message : e)),
  });

  const actions = (q.data?.actions ?? []) as Array<{
    id: string; summary?: string; action_type?: string; status?: string; created_at?: string;
  }>;

  return (
    <WorkspaceShell title="Zenno OS · Action Center">
      <WidgetContainer title="Ações Pendentes" subtitle="Suggested → Approved → Executed">
        {q.isLoading ? <WidgetLoader lines={4} /> :
          q.isError ? <WidgetError message="Falha ao carregar" onRetry={() => q.refetch()} /> :
          actions.length === 0 ? <WidgetEmpty message="Sem ações pendentes." /> :
          <ul className="space-y-2">
            {actions.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 rounded-md border border-border/60 bg-muted/20 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{a.summary ?? a.action_type ?? "Ação"}</p>
                  <p className="text-xs text-muted-foreground">{a.created_at ?? ""}</p>
                  <Badge variant="outline" className="mt-1">{a.status ?? "pending"}</Badge>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => reject.mutate(a.id)} disabled={reject.isPending || approve.isPending}>
                    Rejeitar
                  </Button>
                  <Button size="sm" onClick={() => approve.mutate(a.id)} disabled={approve.isPending || reject.isPending}>
                    Aprovar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        }
      </WidgetContainer>
    </WorkspaceShell>
  );
}
