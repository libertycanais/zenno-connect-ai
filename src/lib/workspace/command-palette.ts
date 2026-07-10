// EPIC K — Command Palette (permission-guarded, telemetry-instrumented)
import type { SecurityTelemetryEmitter } from "./security-telemetry";
import type { CommandDefinition, OrgScoped } from "./types";

export type CommandExecutionContext = OrgScoped & {
  userId: string;
  userPermissions: string[];
  featureFlags: string[];
  input?: string;
};

export type CommandExecutionResult =
  | { ok: true; message?: string }
  | { ok: false; reason: "unknown_command" | "permission_denied" | "feature_disabled" | "run_failed"; message?: string };

export class CommandPalette {
  private commands = new Map<string, CommandDefinition>();

  constructor(private readonly telemetry: SecurityTelemetryEmitter) {}

  register(cmd: CommandDefinition): void {
    if (!cmd.id) throw new Error("command_missing_id");
    this.commands.set(cmd.id, cmd);
  }

  list(scope?: CommandDefinition["scope"]): CommandDefinition[] {
    const all = [...this.commands.values()];
    return scope ? all.filter((c) => c.scope === scope) : all;
  }

  filter(query: string, ctx: CommandExecutionContext): CommandDefinition[] {
    const q = query.trim().toLowerCase();
    return [...this.commands.values()].filter((c) => {
      if (q && !`${c.title} ${c.hint ?? ""}`.toLowerCase().includes(q)) return false;
      if (c.featureFlag && !ctx.featureFlags.includes(c.featureFlag)) return false;
      return c.requiredPermissions.every((p) => ctx.userPermissions.includes(p));
    });
  }

  async run(commandId: string, ctx: CommandExecutionContext): Promise<CommandExecutionResult> {
    const cmd = this.commands.get(commandId);
    if (!cmd) {
      this.telemetry.emit({
        organizationId: ctx.organizationId, userId: ctx.userId,
        name: "command_palette_denied", refs: [commandId],
        meta: { reason: "unknown_command" },
      });
      return { ok: false, reason: "unknown_command" };
    }
    if (cmd.featureFlag && !ctx.featureFlags.includes(cmd.featureFlag)) {
      this.telemetry.emit({
        organizationId: ctx.organizationId, userId: ctx.userId,
        name: "command_palette_denied", refs: [commandId],
        meta: { reason: "feature_disabled", flag: cmd.featureFlag },
      });
      return { ok: false, reason: "feature_disabled" };
    }
    const missing = cmd.requiredPermissions.find((p) => !ctx.userPermissions.includes(p));
    if (missing) {
      this.telemetry.emit({
        organizationId: ctx.organizationId, userId: ctx.userId,
        name: "command_palette_denied", refs: [commandId],
        meta: { reason: "permission_denied", missing },
      });
      return { ok: false, reason: "permission_denied", message: `missing:${missing}` };
    }
    try {
      const result = await cmd.run({
        organizationId: ctx.organizationId, userId: ctx.userId, input: ctx.input,
      });
      return result.ok
        ? { ok: true, message: result.message }
        : { ok: false, reason: "run_failed", message: result.message };
    } catch (e) {
      return { ok: false, reason: "run_failed", message: (e as Error).message };
    }
  }
}
