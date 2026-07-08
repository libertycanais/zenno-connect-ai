// Sprint 5.3 — Observability: exportador em formato texto Prometheus.
// Aditivo, sem dependências. Consumido opcionalmente pelo endpoint de métricas.
//
// Não é habilitado por padrão no /api/public/metrics (que retorna JSON).
// Um scraper Prometheus pode chamar este helper via server function futura.

import type { MetricsSnapshot } from "./metrics";

function escapeLabelValue(v: string | number | boolean): string {
  return String(v).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
}

function renderLabels(labels: Record<string, string | number | boolean>): string {
  const keys = Object.keys(labels).sort();
  if (keys.length === 0) return "";
  const parts = keys.map((k) => `${k}="${escapeLabelValue(labels[k]!)}"`);
  return `{${parts.join(",")}}`;
}

/** Renderiza um snapshot in-memory no formato texto do Prometheus. */
export function toPrometheusText(snap: MetricsSnapshot): string {
  const lines: string[] = [];
  for (const c of snap.counters) {
    lines.push(`# TYPE ${c.name} counter`);
    lines.push(`${c.name}${renderLabels(c.labels)} ${c.value}`);
  }
  for (const h of snap.histograms) {
    lines.push(`# TYPE ${h.name} summary`);
    const base = renderLabels(h.labels);
    const withQuantile = (q: string, v: number) =>
      `${h.name}${base ? base.replace(/}$/, `,quantile="${q}"}`) : `{quantile="${q}"}`} ${v}`;
    lines.push(withQuantile("0.5", h.p50));
    lines.push(withQuantile("0.95", h.p95));
    lines.push(withQuantile("0.99", h.p99));
    lines.push(`${h.name}_sum${base} ${h.sum}`);
    lines.push(`${h.name}_count${base} ${h.count}`);
  }
  return lines.join("\n") + "\n";
}
