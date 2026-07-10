// RC2 Operational Enhancements — contextual feedback for Copilot answers.
// PII-safe: never sends prompt/response bodies — only message/conversation IDs
// + reaction + short (≤2000c) comment. Uses React's default JSX escaping;
// dangerouslySetInnerHTML is forbidden here.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ThumbsUp, ThumbsDown, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { submitCopilotFeedback } from "@/lib/pilot.functions";

interface CopilotFeedbackProps {
  messageId?: string | null;
  conversationId?: string | null;
  modelHint?: string | null;
  latencyMs?: number | null;
  className?: string;
}

const MAX_COMMENT = 2000;

export function CopilotFeedback({
  messageId, conversationId, modelHint, latencyMs, className,
}: CopilotFeedbackProps) {
  const submit = useServerFn(submitCopilotFeedback);
  const [reaction, setReaction] = useState<"up" | "down" | null>(null);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function send(next: "up" | "down") {
    if (sending) return;
    setSending(true);
    setReaction(next);
    try {
      await submit({
        data: {
          reaction: next,
          messageId: messageId ?? null,
          conversationId: conversationId ?? null,
          comment: comment ? comment.slice(0, MAX_COMMENT) : null,
          modelHint: modelHint ?? null,
          latencyMs: latencyMs ?? null,
        },
      });
      setSent(true);
      toast.success(next === "up" ? "Obrigado pelo feedback!" : "Feedback registrado — vamos melhorar.");
    } catch {
      toast.error("Não foi possível enviar seu feedback.");
      setReaction(null);
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className={`text-xs text-muted-foreground flex items-center gap-2 ${className ?? ""}`}
           role="status" aria-live="polite">
        {reaction === "up" ? <ThumbsUp size={14} /> : <ThumbsDown size={14} />}
        Feedback enviado.
      </div>
    );
  }

  return (
    <Card className={`p-3 space-y-2 bg-muted/30 ${className ?? ""}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Esta resposta foi útil?</span>
        <Button
          size="sm" variant={reaction === "up" ? "default" : "ghost"}
          onClick={() => send("up")} disabled={sending}
          aria-label="Marcar resposta como útil"
        >
          <ThumbsUp size={14} className="mr-1" /> Útil
        </Button>
        <Button
          size="sm" variant={reaction === "down" ? "destructive" : "ghost"}
          onClick={() => setReaction("down")} disabled={sending}
          aria-label="Marcar resposta como não útil"
        >
          <ThumbsDown size={14} className="mr-1" /> Não útil
        </Button>
      </div>
      {reaction === "down" && (
        <div className="space-y-2">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT))}
            placeholder="Por quê? (opcional, até 2000 caracteres)"
            className="min-h-[70px] text-sm"
            maxLength={MAX_COMMENT}
            aria-label="Motivo do feedback negativo"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{comment.length} / {MAX_COMMENT}</span>
            <Button size="sm" onClick={() => send("down")} disabled={sending}>
              <Send size={14} className="mr-1" /> Enviar
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
