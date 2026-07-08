import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  copilotChat,
  listCopilotConversations,
  getCopilotConversation,
  listPendingActions,
  approvePendingAction,
  rejectPendingAction,
} from "@/lib/copilot.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Bot, Send, Sparkles, User, Wrench, Plus, MessageSquare, Check, X, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/ia/copiloto")({
  component: CopilotoPage,
  head: () => ({
    meta: [
      { title: "Copiloto de Tráfego · ZENNO" },
      { name: "description", content: "Copiloto de IA para gestores de tráfego: analise campanhas Meta e Google em linguagem natural." },
    ],
  }),
});

type Msg = { id?: string; role: "user" | "assistant" | "tool"; content: string; tool_name?: string | null };

function CopilotoPage() {
  const chat = useServerFn(copilotChat);
  const listConv = useServerFn(listCopilotConversations);
  const getConv = useServerFn(getCopilotConversation);
  const qc = useQueryClient();

  const [convId, setConvId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const convs = useQuery({
    queryKey: ["copilot-conversations"],
    queryFn: () => listConv({}),
  });

  const msgsQ = useQuery({
    queryKey: ["copilot-conv", convId],
    queryFn: () => (convId ? getConv({ data: { id: convId } }) : Promise.resolve({ messages: [] })),
    enabled: !!convId,
  });

  const [pending, setPending] = useState<Msg[]>([]);
  const messages: Msg[] = [
    ...((msgsQ.data?.messages ?? []) as any[]).map((m) => ({
      id: m.id,
      role: m.role as Msg["role"],
      content: m.content ?? "",
      tool_name: m.tool_name,
    })),
    ...pending,
  ];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const mut = useMutation({
    mutationFn: (message: string) => chat({ data: { conversationId: convId, message } }),
    onSuccess: (r) => {
      setPending([]);
      setConvId(r.conversationId);
      qc.invalidateQueries({ queryKey: ["copilot-conv", r.conversationId] });
      qc.invalidateQueries({ queryKey: ["copilot-conversations"] });
    },
    onError: (e: Error) => {
      setPending((p) => p.filter((m) => m.role !== "user" || m.content !== input));
      toast.error(e.message);
    },
  });

  function send() {
    const text = input.trim();
    if (!text || mut.isPending) return;
    setPending([{ role: "user", content: text }]);
    setInput("");
    mut.mutate(text);
  }

  const suggestions = [
    "Quais campanhas Meta estão ativas?",
    "Como estão minhas conversões nos últimos 7 dias?",
    "Resumo dos leads por origem esta semana",
    "Liste todas as contas de cliente conectadas",
  ];

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4 p-4">
      {/* Sidebar de conversas */}
      <aside className="hidden md:flex flex-col w-64 shrink-0">
        <Button
          variant="outline"
          className="mb-3 justify-start gap-2"
          onClick={() => {
            setConvId(null);
            setPending([]);
          }}
        >
          <Plus size={16} /> Nova conversa
        </Button>
        <div className="flex-1 overflow-auto space-y-1">
          {(convs.data?.conversations ?? []).map((c) => (
            <button
              key={c.id}
              onClick={() => setConvId(c.id)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-muted flex items-center gap-2 truncate",
                convId === c.id && "bg-muted",
              )}
            >
              <MessageSquare size={14} className="shrink-0 text-muted-foreground" />
              <span className="truncate">{c.title}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="text-primary" size={20} />
          <h1 className="text-lg font-semibold">Copiloto de Tráfego</h1>
          <span className="text-xs text-muted-foreground ml-2">Claude Sonnet 4.5</span>
        </div>

        <div className="flex-1 overflow-auto space-y-3 pr-2">
          {messages.length === 0 && (
            <Card className="p-6 text-center space-y-4">
              <Bot className="mx-auto text-primary" size={32} />
              <div>
                <h2 className="font-semibold">Olá! Sou seu Copiloto de Tráfego.</h2>
                <p className="text-sm text-muted-foreground">
                  Analiso Meta Ads e Google Ads dos seus clientes com dados reais.
                </p>
              </div>
              <div className="grid gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="text-left px-3 py-2 rounded-lg border border-border hover:bg-muted text-sm"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </Card>
          )}

          {messages.map((m, i) => {
            if (m.role === "tool") {
              return (
                <div key={m.id ?? i} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Wrench size={12} />
                  <span>consultou <code className="text-primary">{m.tool_name}</code></span>
                </div>
              );
            }
            const isUser = m.role === "user";
            if (m.role === "assistant" && !m.content) return null;
            return (
              <div key={m.id ?? i} className={cn("flex gap-3", isUser && "justify-end")}>
                {!isUser && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot size={16} className="text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap",
                    isUser ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  {m.content}
                </div>
                {isUser && (
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User size={16} />
                  </div>
                )}
              </div>
            );
          })}

          {mut.isPending && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot size={16} className="text-primary animate-pulse" />
              </div>
              <div className="bg-muted rounded-2xl px-4 py-2 text-sm text-muted-foreground">
                pensando…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Composer */}
        <div className="mt-3 flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte sobre suas campanhas, leads, performance…"
            rows={2}
            className="resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <Button onClick={send} disabled={mut.isPending || !input.trim()} size="icon" className="h-full">
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
