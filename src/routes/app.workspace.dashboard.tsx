// EPIC K.2 — /app/workspace/dashboard
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { WorkspaceGrid } from "@/components/workspace/WorkspaceGrid";
import { DashboardLayoutEditor, type LayoutItem } from "@/components/workspace/DashboardLayoutEditor";
import { WIDGET_REGISTRY, type WidgetId } from "@/components/workspace/widgets";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { saveLayout as saveLayoutFn, listLayouts } from "@/lib/workspace-persistence.functions";

export const Route = createFileRoute("/app/workspace/dashboard")({ component: DashboardPage });

const DEFAULT_ORDER: WidgetId[] = [
  "executive-score", "recommendations", "insights",
  "timeline", "signals", "forecast",
  "business-dna", "memory", "action-center",
];
const LS_KEY = "zenno.workspace.dashboard.order";

function DashboardPage() {
  const list = useServerFn(listLayouts);
  const save = useServerFn(saveLayoutFn);
  const [order, setOrder] = useState<WidgetId[]>(DEFAULT_ORDER);
  const [editing, setEditing] = useState(false);

  useQuery({
    queryKey: ["ws", "layouts", "dashboard"],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => list({ data: { workspaceId: "default" } as any }).catch(() => ({ layouts: [] as any[] })),
    staleTime: 60_000,
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as WidgetId[];
        const filtered = arr.filter((id) => id in WIDGET_REGISTRY);
        if (filtered.length) setOrder(filtered as WidgetId[]);
      }
    } catch { /* ignore */ }
  }, []);

  const items: LayoutItem[] = order.map((id) => ({ id, label: WIDGET_REGISTRY[id].label }));

  return (
    <WorkspaceShell title="Zenno OS · Dashboard">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Dashboard modular consumindo Intelligence + Executive Engines.</p>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted"
        >
          {editing ? "Fechar editor" : "Editar layout"}
        </button>
      </div>

      {editing && (
        <div className="mb-4">
          <DashboardLayoutEditor
            items={items}
            onReset={() => { setOrder(DEFAULT_ORDER); localStorage.removeItem(LS_KEY); toast.success("Layout restaurado"); }}
            onSave={async (ids) => {
              const next = ids.filter((i): i is WidgetId => i in WIDGET_REGISTRY);
              setOrder(next);
              localStorage.setItem(LS_KEY, JSON.stringify(next));
              try {
                await save({
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  data: {
                    workspaceId: "default",
                    name: "dashboard",
                    grid: { columns: 12 },
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  } as any,
                });
                toast.success("Layout salvo");
              } catch {
                toast.warning("Salvo localmente (persistência remota indisponível)");
              }
            }}
          />
        </div>
      )}

      <WorkspaceGrid>
        {order.map((id) => {
          const W = WIDGET_REGISTRY[id].component;
          return <W key={id} />;
        })}
      </WorkspaceGrid>
    </WorkspaceShell>
  );
}
