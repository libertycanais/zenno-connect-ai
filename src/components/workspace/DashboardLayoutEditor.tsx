// EPIC K.2 — DashboardLayoutEditor (rearranjo simples de widgets)
// Não altera Workspace Engine — apenas emite ordem e chama saveLayout.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GripVertical, Save, RotateCcw } from "lucide-react";

export type LayoutItem = { id: string; label: string };

type Props = {
  items: LayoutItem[];
  onSave: (order: string[]) => Promise<void> | void;
  onReset?: () => void;
};

export function DashboardLayoutEditor({ items, onSave, onReset }: Props) {
  const [order, setOrder] = useState(items);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  function onDragStart(idx: number) { setDragIdx(idx); }
  function onDragOver(e: React.DragEvent) { e.preventDefault(); }
  function onDrop(idx: number) {
    if (dragIdx === null || dragIdx === idx) return;
    const next = [...order];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(idx, 0, moved);
    setOrder(next);
    setDragIdx(null);
  }

  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium">Ordenar Widgets</p>
        <div className="flex gap-1">
          {onReset && (
            <Button variant="ghost" size="sm" onClick={() => { setOrder(items); onReset(); }}>
              <RotateCcw size={14} className="mr-1" /> Reset
            </Button>
          )}
          <Button
            size="sm"
            disabled={saving}
            onClick={async () => { setSaving(true); try { await onSave(order.map((o) => o.id)); } finally { setSaving(false); } }}
          >
            <Save size={14} className="mr-1" /> Salvar Layout
          </Button>
        </div>
      </div>
      <ul className="space-y-1">
        {order.map((it, idx) => (
          <li
            key={it.id}
            draggable
            onDragStart={() => onDragStart(idx)}
            onDragOver={onDragOver}
            onDrop={() => onDrop(idx)}
            className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm cursor-grab active:cursor-grabbing"
          >
            <GripVertical size={14} className="text-muted-foreground" />
            <span className="truncate">{it.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
