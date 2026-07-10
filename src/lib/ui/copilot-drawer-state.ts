// RC1.7 — Persistência de estado do Copilot Drawer (tab + scroll).
// Usa localStorage como cache leve; sincroniza com `workspace_preferences`
// via server-fn quando disponível (best-effort, opt-in).

const KEY = "zenno.copilot.drawer.state.v1";

export type CopilotDrawerState = {
  tab: "conversation" | "trace" | "lineage";
  scrollTop: number;
  updatedAt: number;
};

const DEFAULT: CopilotDrawerState = {
  tab: "conversation",
  scrollTop: 0,
  updatedAt: 0,
};

export function readCopilotDrawerState(): CopilotDrawerState {
  try {
    if (typeof window === "undefined") return DEFAULT;
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<CopilotDrawerState>;
    return {
      tab: parsed.tab ?? DEFAULT.tab,
      scrollTop: Number.isFinite(parsed.scrollTop) ? Number(parsed.scrollTop) : 0,
      updatedAt: Number.isFinite(parsed.updatedAt) ? Number(parsed.updatedAt) : 0,
    };
  } catch {
    return DEFAULT;
  }
}

export function writeCopilotDrawerState(next: Partial<CopilotDrawerState>): void {
  try {
    if (typeof window === "undefined") return;
    const merged: CopilotDrawerState = {
      ...readCopilotDrawerState(),
      ...next,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(KEY, JSON.stringify(merged));
  } catch {
    /* ignore quota / SSR */
  }
}

export function clearCopilotDrawerState(): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
