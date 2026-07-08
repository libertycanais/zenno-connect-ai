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
            <div className="px-4 py-3 border-b border-border">
              <div className="font-medium">{activeChat.name ?? activeChat.phone}</div>
              <div className="text-xs text-muted-foreground">{activeChat.phone}</div>
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
