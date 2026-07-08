import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useInstances, useChats, useMessages, useSendMessage } from "@/modules/whatsapp/hooks";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, DollarSign, X } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { markWhatsappConversion } from "@/lib/whatsapp.functions";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const Route = createFileRoute("/app/whatsapp/chat")({
  component: ChatPage,
});

function ChatPage() {
  const { data: instances = [] } = useInstances();
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!instanceId && instances.length > 0) setInstanceId(instances[0].id);
  }, [instances, instanceId]);

  const { data: chats = [] } = useChats(instanceId);
  const { data: messages = [] } = useMessages(chatId);
  const send = useSendMessage();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const activeChat = chats.find((c) => c.id === chatId);

  async function handleSend() {
    if (!instanceId || !activeChat || !text.trim()) return;
    try {
      await send.mutateAsync({ instanceId, phone: activeChat.phone, text: text.trim() });
      setText("");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao enviar");
    }
  }

  return (
    <div className="flex h-full">
      {/* Sidebar: chats */}
      <div className="w-80 shrink-0 border-r border-border flex flex-col">
        <div className="p-2 border-b border-border">
          <select
            className="w-full bg-background border border-border rounded-md p-2 text-sm"
            value={instanceId ?? ""}
            onChange={(e) => { setInstanceId(e.target.value || null); setChatId(null); }}
          >
            <option value="">Selecione uma instância</option>
            {instances.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>
        <div className="flex-1 overflow-y-auto">
          {chats.length === 0 && <div className="p-4 text-sm text-muted-foreground">Nenhuma conversa.</div>}
          {chats.map((c) => (
            <button
              key={c.id}
              onClick={() => setChatId(c.id)}
              className={`w-full text-left px-3 py-2 border-b border-border/50 hover:bg-muted ${chatId === c.id ? "bg-muted" : ""}`}
            >
              <div className="flex justify-between items-center">
                <div className="font-medium truncate">{c.name ?? c.phone}</div>
                {c.unread_count > 0 && <span className="text-[10px] bg-primary text-primary-foreground px-1.5 rounded-full">{c.unread_count}</span>}
              </div>
              <div className="text-xs text-muted-foreground truncate">{c.last_message_preview}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Conversation */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeChat ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">Selecione uma conversa</div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-border flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{activeChat.name ?? activeChat.phone}</div>
                <div className="text-xs text-muted-foreground">{activeChat.phone}</div>
                {activeChat.attributed_at ? (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {activeChat.first_utm_source ? <Badge variant="secondary" className="text-[10px]">src: {activeChat.first_utm_source}</Badge> : null}
                    {activeChat.first_utm_campaign ? <Badge variant="secondary" className="text-[10px]">camp: {activeChat.first_utm_campaign}</Badge> : null}
                    {activeChat.first_fbclid ? <Badge variant="outline" className="text-[10px]">fbclid</Badge> : null}
                    {activeChat.first_gclid ? <Badge variant="outline" className="text-[10px]">gclid</Badge> : null}
                    {activeChat.conversion_status === "customer"
                      ? <Badge className="text-[10px] bg-emerald-500/20 text-emerald-600 border-emerald-500/40">venda {activeChat.conversion_value ? `· ${activeChat.conversion_value}` : ""}</Badge>
                      : null}
                  </div>
                ) : (
                  <div className="text-[10px] text-muted-foreground mt-1">sem atribuição</div>
                )}
              </div>
              <ConversionButton chatId={activeChat.id} isCustomer={activeChat.conversion_status === "customer"} />
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/30">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${m.direction === "out" ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
                    {m.content ?? <em className="opacity-70">[{m.message_type}]</em>}
                    <div className="text-[10px] opacity-60 mt-1">{new Date(m.created_at).toLocaleTimeString()}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-border flex gap-2">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Digite uma mensagem…"
              />
              <Button onClick={handleSend} disabled={send.isPending || !text.trim()}><Send size={16} /></Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ConversionButton({ chatId, isCustomer }: { chatId: string; isCustomer: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState("BRL");
  const mark = useServerFn(markWhatsappConversion);
  const mut = useMutation({
    mutationFn: (input: { status: "customer" | "lost" | "lead"; value?: number; currency?: string }) =>
      mark({ data: { chatId, ...input } }),
    onSuccess: (r) => {
      toast.success(r.dispatched ? "Venda registrada e enviada para CAPI" : "Status atualizado");
      qc.invalidateQueries({ queryKey: ["wa-chats"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isCustomer) {
    return (
      <Button size="sm" variant="ghost" onClick={() => mut.mutate({ status: "lead" })}>
        <X size={14} className="mr-1" />Desmarcar venda
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default"><DollarSign size={14} className="mr-1" />Marcar venda</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Registrar venda</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Valor</label>
            <Input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} placeholder="297.00" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Moeda</label>
            <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))} />
          </div>
          <p className="text-xs text-muted-foreground">
            Dispara Purchase para Meta CAPI (via fbclid) e Google Offline Conversion (via gclid) se a conversa tiver atribuição.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            disabled={mut.isPending}
            onClick={() => mut.mutate({ status: "customer", value: value ? Number(value) : undefined, currency })}
          >Confirmar venda</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
