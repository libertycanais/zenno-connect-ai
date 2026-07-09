// FEATURE P0.6 — Onda 3 · Tool Calling infrastructure (contracts only)
// Real tool implementations arrive in Onda 4/5. This module defines the
// wire contracts so providers can be adapted upfront.

import { z, type ZodTypeAny } from "zod";

export type ToolAuthScope = "read" | "write" | "admin";

export type ToolDescriptor<TInput extends ZodTypeAny = ZodTypeAny> = {
  name: string;
  description: string;
  scope: ToolAuthScope;
  inputSchema: TInput;
  needsApproval: boolean;
};

export type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type ToolResult =
  | { id: string; ok: true; result: unknown }
  | { id: string; ok: false; errorCode: string; errorMessage: string };

export interface ToolExecutor {
  execute(call: ToolCall, ctx: { organizationId: string; userId: string }): Promise<ToolResult>;
}

export class ToolRegistry {
  private byName = new Map<string, ToolDescriptor>();
  register<T extends ZodTypeAny>(t: ToolDescriptor<T>): void {
    this.byName.set(t.name, t as ToolDescriptor);
  }
  get(name: string): ToolDescriptor | undefined { return this.byName.get(name); }
  list(): ToolDescriptor[] { return [...this.byName.values()]; }
  validateArgs(name: string, args: unknown): { ok: true; args: unknown } | { ok: false; error: string } {
    const t = this.byName.get(name);
    if (!t) return { ok: false, error: `unknown_tool:${name}` };
    const parsed = t.inputSchema.safeParse(args);
    if (!parsed.success) return { ok: false, error: parsed.error.message };
    return { ok: true, args: parsed.data };
  }
}

export const toolRegistry = new ToolRegistry();

// Example placeholder — safe read-only ping. Ensures the registry has 1 tool
// so provider adapters can be wired end-to-end without side effects.
toolRegistry.register({
  name: "system.ping",
  description: "Verifica se o runtime de tools está acessível. Não realiza ação.",
  scope: "read",
  needsApproval: false,
  inputSchema: z.object({ echo: z.string().max(200).optional() }),
});
