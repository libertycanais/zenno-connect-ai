import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateInstance } from "./hooks";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export function NewInstanceDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://free.uazapi.com");
  const [token, setToken] = useState("");
  const create = useCreateInstance();

  async function submit() {
    if (!name.trim() || !baseUrl.trim() || !token.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }
    try {
      await create.mutateAsync({ name: name.trim(), base_url: baseUrl.trim().replace(/\/$/, ""), token: token.trim() });
      toast.success("Instância criada");
      setOpen(false);
      setName(""); setToken("");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao criar instância");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus size={16} className="mr-1" /> Nova instância</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova instância WhatsApp (Uazapi)</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Atendimento Principal" /></div>
          <div><Label>Base URL Uazapi</Label><Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} /></div>
          <div><Label>Token da instância</Label><Input value={token} onChange={(e) => setToken(e.target.value)} type="password" /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={create.isPending}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
