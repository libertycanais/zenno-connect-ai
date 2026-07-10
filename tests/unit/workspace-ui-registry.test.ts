// EPIC K.2 — Workspace UI · Smoke tests (renderability + registry contract)
import { describe, it, expect, vi } from "vitest";
import { WIDGET_REGISTRY } from "@/components/workspace/widgets";
import { readCommandHistory } from "@/components/workspace/CommandPalette";

describe("EPIC K.2 · Widget Registry", () => {
  it("expõe os 12 widgets canônicos", () => {
    const ids = Object.keys(WIDGET_REGISTRY);
    expect(ids).toContain("executive-score");
    expect(ids).toContain("recommendations");
    expect(ids).toContain("insights");
    expect(ids).toContain("signals");
    expect(ids).toContain("timeline");
    expect(ids).toContain("forecast");
    expect(ids).toContain("business-dna");
    expect(ids).toContain("memory");
    expect(ids).toContain("consensus");
    expect(ids).toContain("learning");
    expect(ids).toContain("notifications");
    expect(ids).toContain("action-center");
    expect(ids.length).toBe(12);
  });

  it("cada widget expõe label e component", () => {
    for (const [id, entry] of Object.entries(WIDGET_REGISTRY)) {
      expect(entry.label, `${id}.label`).toBeTypeOf("string");
      expect(entry.component, `${id}.component`).toBeTypeOf("function");
    }
  });
});

describe("EPIC K.2 · CommandPalette history", () => {
  it("retorna array vazio quando storage vazio", () => {
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    });
    expect(readCommandHistory()).toEqual([]);
    vi.unstubAllGlobals();
  });

  it("é resiliente a JSON inválido", () => {
    const store: Record<string, string> = { "zenno.cmd.history": "{{invalid" };
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    });
    expect(readCommandHistory()).toEqual([]);
    vi.unstubAllGlobals();
  });
});
