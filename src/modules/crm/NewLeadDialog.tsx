import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { useCreateLead } from "./useLeads";
import { toast } from "sonner";

const schema = z.object({
  name: z.string().trim().min(2, "Nome obrigatório").max(120),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email("Email inválido").max(255).optional().or(z.literal("")),
  source: z.string().trim().max(60).optional().or(z.literal("")),
  campaign: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export function NewLeadDialog() {
  const [open, setOpen] = useState(false);
  const create = useCreateLead();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    try {
      await create.mutateAsync({
        name: parsed.data.name,
        phone: parsed.data.phone || undefined,
        email: parsed.data.email || undefined,
        source: parsed.data.source || undefined,
        campaign: parsed.data.campaign || undefined,
        notes: parsed.data.notes || undefined,
      });
      toast.success("Lead criado");
      setOpen(false);
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus size={16} className="mr-1" /> Novo Lead</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo Lead</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="name">Nome*</Label><Input id="name" name="name" required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="phone">Telefone</Label><Input id="phone" name="phone" /></div>
            <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="source">Origem</Label><Input id="source" name="source" placeholder="Meta, Google, Indicação..." /></div>
            <div className="space-y-1.5"><Label htmlFor="campaign">Campanha</Label><Input id="campaign" name="campaign" /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="notes">Observações</Label><Textarea id="notes" name="notes" rows={3} /></div>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? "Salvando..." : "Criar Lead"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
