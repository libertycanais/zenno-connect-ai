import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable,
} from "@dnd-kit/core";
import { useLeads, useUpdateLeadStatus } from "@/modules/crm/useLeads";
import { LEAD_STATUSES, type LeadStatus, type Lead } from "@/modules/crm/leadStatus";
import { NewLeadDialog } from "@/modules/crm/NewLeadDialog";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/app/leads/kanban")({ component: Kanban });

function LeadCard({ lead }: { lead: Lead }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <Card ref={setNodeRef} style={style} {...listeners} {...attributes}
      className="p-3 cursor-grab active:cursor-grabbing bg-card hover:border-primary/50 transition-colors">
      <div className="font-medium text-sm">{lead.name}</div>
      {lead.phone && <div className="text-xs text-muted-foreground mt-1">{lead.phone}</div>}
      {lead.source && <div className="text-[10px] uppercase tracking-wider text-primary mt-2">{lead.source}</div>}
    </Card>
  );
}

function Column({ status, label, leads }: { status: LeadStatus; label: string; leads: Lead[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef}
      className={`w-72 shrink-0 rounded-lg bg-muted/30 p-3 flex flex-col ${isOver ? "ring-2 ring-primary" : ""}`}>
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="font-semibold text-sm">{label}</h3>
        <span className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded-full">{leads.length}</span>
      </div>
      <div className="space-y-2 flex-1 min-h-[100px]">
        {leads.map((l) => <LeadCard key={l.id} lead={l} />)}
      </div>
    </div>
  );
}

function Kanban() {
  const { data: leads } = useLeads();
  const updateStatus = useUpdateLeadStatus();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const grouped = useMemo(() => {
    const map = new Map<LeadStatus, Lead[]>();
    for (const s of LEAD_STATUSES) map.set(s.id, []);
    for (const l of leads ?? []) map.get(l.status)?.push(l);
    return map;
  }, [leads]);

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const newStatus = over.id as LeadStatus;
    const lead = (leads ?? []).find((l) => l.id === active.id);
    if (!lead || lead.status === newStatus) return;
    try { await updateStatus.mutateAsync({ id: lead.id, status: newStatus }); }
    catch (err: any) { toast.error(err.message); }
  }

  return (
    <div className="p-6 md:p-8 h-screen flex flex-col">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Pipeline de Vendas</h1>
          <p className="text-muted-foreground text-sm">Arraste os leads entre as etapas</p>
        </div>
        <NewLeadDialog />
      </div>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-6 flex-1">
          {LEAD_STATUSES.map((s) => (
            <Column key={s.id} status={s.id} label={s.label} leads={grouped.get(s.id) ?? []} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
