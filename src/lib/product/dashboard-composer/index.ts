// EPIC J — DashboardComposer · org-scoped dashboards built from widgets
import type { DashboardLayout, OrgScoped, WidgetDescriptor } from "../types";
import { WidgetEngine } from "../widget-engine";

const now = (): string => new Date().toISOString();
const genId = (p: string): string => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export class DashboardComposer {
  private byOrg = new Map<string, Map<string, DashboardLayout>>();

  constructor(private engine: WidgetEngine) {}

  private bucket(org: string): Map<string, DashboardLayout> {
    if (!this.byOrg.has(org)) this.byOrg.set(org, new Map());
    return this.byOrg.get(org)!;
  }

  create(o: OrgScoped, name: string, widgets: WidgetDescriptor[] = []): DashboardLayout {
    for (const w of widgets) {
      const v = this.engine.validate(w);
      if (!v.ok) throw new Error(`widget_invalid:${v.error}`);
    }
    const layout: DashboardLayout = {
      organizationId: o.organizationId,
      id: genId("dash"),
      name,
      widgets: normalize(widgets),
      updatedAt: now(),
    };
    this.bucket(o.organizationId).set(layout.id, layout);
    return layout;
  }

  addWidget(o: OrgScoped, dashboardId: string, w: WidgetDescriptor): DashboardLayout {
    const v = this.engine.validate(w);
    if (!v.ok) throw new Error(`widget_invalid:${v.error}`);
    const layout = this.mustGet(o, dashboardId);
    const next: DashboardLayout = {
      ...layout,
      widgets: normalize([...layout.widgets, w]),
      updatedAt: now(),
    };
    this.bucket(o.organizationId).set(dashboardId, next);
    return next;
  }

  removeWidget(o: OrgScoped, dashboardId: string, widgetId: string): DashboardLayout {
    const layout = this.mustGet(o, dashboardId);
    const next: DashboardLayout = {
      ...layout,
      widgets: normalize(layout.widgets.filter((w) => w.id !== widgetId)),
      updatedAt: now(),
    };
    this.bucket(o.organizationId).set(dashboardId, next);
    return next;
  }

  reorder(o: OrgScoped, dashboardId: string, order: string[]): DashboardLayout {
    const layout = this.mustGet(o, dashboardId);
    const idx = new Map(order.map((id, i) => [id, i]));
    const widgets = layout.widgets.slice().sort((a, b) => (idx.get(a.id) ?? 999) - (idx.get(b.id) ?? 999));
    const next: DashboardLayout = { ...layout, widgets: normalize(widgets), updatedAt: now() };
    this.bucket(o.organizationId).set(dashboardId, next);
    return next;
  }

  get(o: OrgScoped, id: string): DashboardLayout | null { return this.bucket(o.organizationId).get(id) ?? null; }
  list(o: OrgScoped): DashboardLayout[] { return [...this.bucket(o.organizationId).values()]; }

  private mustGet(o: OrgScoped, id: string): DashboardLayout {
    const l = this.get(o, id);
    if (!l) throw new Error("dashboard_not_found");
    return l;
  }
}

function normalize(widgets: WidgetDescriptor[]): WidgetDescriptor[] {
  return widgets.map((w, i) => ({ ...w, position: i }));
}
