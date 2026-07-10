// EPIC J — WidgetEngine · registry + validation of widget descriptors
import type { WidgetDescriptor, WidgetType } from "../types";

const KNOWN: WidgetType[] = [
  "executive_score", "kpis", "forecast", "timeline",
  "signals", "insights", "recommendations", "memory", "experts",
];

export type WidgetRenderer<TProps = Record<string, unknown>> = {
  type: WidgetType;
  version: string;
  defaultSize: WidgetDescriptor["size"];
  defaultProps?: TProps;
};

export class WidgetEngine {
  private registry = new Map<WidgetType, WidgetRenderer>();

  register(r: WidgetRenderer): void {
    if (!KNOWN.includes(r.type)) throw new Error(`unknown_widget_type:${r.type}`);
    this.registry.set(r.type, r);
  }

  get(type: WidgetType): WidgetRenderer | null { return this.registry.get(type) ?? null; }
  list(): WidgetRenderer[] { return [...this.registry.values()]; }
  isKnown(type: string): boolean { return KNOWN.includes(type as WidgetType); }

  validate(w: WidgetDescriptor): { ok: boolean; error?: string } {
    if (!this.isKnown(w.type)) return { ok: false, error: `unknown_type:${w.type}` };
    if (!w.id) return { ok: false, error: "missing_id" };
    if (!w.title) return { ok: false, error: "missing_title" };
    if (w.position < 0) return { ok: false, error: "invalid_position" };
    return { ok: true };
  }
}

/** Default widget catalog — safe defaults, no runtime cost. */
export function registerDefaultWidgets(engine: WidgetEngine): void {
  const defaults: WidgetRenderer[] = [
    { type: "executive_score", version: "1", defaultSize: "md" },
    { type: "kpis",             version: "1", defaultSize: "lg" },
    { type: "forecast",         version: "1", defaultSize: "md" },
    { type: "timeline",         version: "1", defaultSize: "lg" },
    { type: "signals",          version: "1", defaultSize: "md" },
    { type: "insights",         version: "1", defaultSize: "md" },
    { type: "recommendations",  version: "1", defaultSize: "lg" },
    { type: "memory",           version: "1", defaultSize: "sm" },
    { type: "experts",          version: "1", defaultSize: "sm" },
  ];
  for (const d of defaults) engine.register(d);
}
