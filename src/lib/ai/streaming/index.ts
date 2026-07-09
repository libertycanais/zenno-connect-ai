// FEATURE P0.6 — Onda 3 · Streaming Engine
// Unified streaming contract. Adapters (OpenAI/Anthropic/Gemini) convert their
// native SSE/AsyncIterable into StreamEvent chunks. UI consumes the contract.

export type StreamEvent =
  | { kind: "start"; provider: string; model: string }
  | { kind: "delta"; text: string }
  | { kind: "tool_call"; id: string; name: string; args: Record<string, unknown> }
  | { kind: "tool_result"; id: string; result: unknown }
  | { kind: "reasoning"; text: string }
  | { kind: "usage"; tokensIn: number; tokensOut: number }
  | { kind: "error"; code: string; message: string }
  | { kind: "end"; reason: "stop" | "length" | "tool" | "error" | "abort" };

export interface StreamingProvider {
  stream(args: {
    provider: string;
    model: string;
    systemPrompt: string;
    userPrompt: string;
    signal: AbortSignal;
  }): AsyncIterable<StreamEvent>;
}

/**
 * Aggregates a stream into a final text + usage summary. Useful for
 * non-streaming consumers (background tasks, tests).
 */
export async function collectStream(iter: AsyncIterable<StreamEvent>): Promise<{
  text: string;
  reasoning: string;
  tokensIn: number;
  tokensOut: number;
  endReason: StreamEvent extends { kind: "end"; reason: infer R } ? R : never;
  errors: Array<{ code: string; message: string }>;
}> {
  let text = "";
  let reasoning = "";
  let tokensIn = 0;
  let tokensOut = 0;
  let endReason: "stop" | "length" | "tool" | "error" | "abort" = "stop";
  const errors: Array<{ code: string; message: string }> = [];
  for await (const ev of iter) {
    switch (ev.kind) {
      case "delta": text += ev.text; break;
      case "reasoning": reasoning += ev.text; break;
      case "usage": tokensIn = ev.tokensIn; tokensOut = ev.tokensOut; break;
      case "error": errors.push({ code: ev.code, message: ev.message }); break;
      case "end": endReason = ev.reason; break;
      default: break;
    }
  }
  return { text, reasoning, tokensIn, tokensOut, endReason: endReason as never, errors };
}

/** SSE serializer — used by chat server routes to emit events over HTTP. */
export function toSSE(ev: StreamEvent): string {
  return `event: ${ev.kind}\ndata: ${JSON.stringify(ev)}\n\n`;
}

/** Build an SSE ReadableStream from an AsyncIterable<StreamEvent>. */
export function toSSEResponse(iter: AsyncIterable<StreamEvent>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const ev of iter) controller.enqueue(encoder.encode(toSSE(ev)));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(toSSE({ kind: "error", code: "STREAM_FAIL", message: msg })));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
