import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { askAssistant } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/ia/")({
  component: AssistantPage,
});

type Msg = { role: "user" | "assistant"; content: string };

function AssistantPage() {
  const ask = useServerFn(askAssistant);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const mut = useMutation({
    mutationFn: (msgs: Msg[]) => ask({ data: { messages: msgs } }),
    onSuccess: (r) => setMessages((m) => [...m, { role: "assistant", content: r.reply }]),
    onError: (e: Error) => toast.error(e.message),
  });

  function send() {
    if (!input.trim() || mut.isPending) return;
    const next: Msg[] = [...messages, { role: "user", content: input.trim() }];
    setMessages(next);
    setInput("");
    mut.mutate(next);
  }

  const suggestions = [
    "Como melhorar minha taxa de conversão de leads?",
    "Sugira um script de abordagem para WhatsApp",
    "Quais KPIs devo acompanhar no meu funil?",
  ];

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto p-6">
      <div className="flex-1 overflow-auto space-y-3 mb-4">
        {messages.length === 0 && (
          <Card className="p-6 text-center space-y-4">
            <Sparkles className="mx-auto text-primary" size={32} />
            <div>
              <h2 className="font-semibold text-lg">Olá! Sou o assistente ZENNO</h2>
              <p className="text-sm text-muted-foreground">Pergunte sobre CRM, vendas, marketing ou seu negócio.</p>
            </div>
            <div className="grid gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="text-sm text-left p-3 rounded-md border border-border hover:bg-muted transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </Card>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
            {m.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <Bot size={16} className="text-primary" />
              </div>
            )}
            <Card className={`p-3 max-w-[80%] whitespace-pre-wrap text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : ""}`}>
              {m.content}
            </Card>
            {m.role === "user" && (
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <User size={16} />
              </div>
            )}
          </div>
        ))}
        {mut.isPending && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
              <Bot size={16} className="text-primary animate-pulse" />
            </div>
            <Card className="p-3 text-sm text-muted-foreground">Pensando...</Card>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 items-end">
        <Textarea
          placeholder="Pergunte algo..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          className="resize-none"
        />
        <Button onClick={send} disabled={!input.trim() || mut.isPending}>
          <Send size={14} />
        </Button>
      </div>
    </div>
  );
}
