// Anomaly Engine — statistical utilities (pure, no I/O).
export type AnomalyMethod = "zscore" | "iqr" | "mad";

export type AnomalyResult = {
  index: number; value: number; score: number; isAnomaly: boolean;
};

function mean(xs: number[]) { return xs.reduce((a, b) => a + b, 0) / (xs.length || 1); }
function std(xs: number[]) {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length || 1));
}

export function detectAnomalies(series: number[], opts: { method?: AnomalyMethod; threshold?: number } = {}): AnomalyResult[] {
  const method = opts.method ?? "zscore";
  const th = opts.threshold ?? 2.5;
  if (series.length < 3) return series.map((v, i) => ({ index: i, value: v, score: 0, isAnomaly: false }));

  if (method === "zscore") {
    const m = mean(series); const s = std(series) || 1;
    return series.map((v, i) => { const z = (v - m) / s; return { index: i, value: v, score: z, isAnomaly: Math.abs(z) >= th }; });
  }
  if (method === "iqr") {
    const sorted = [...series].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length / 4)];
    const q3 = sorted[Math.floor(3 * sorted.length / 4)];
    const iqr = q3 - q1 || 1;
    return series.map((v, i) => {
      const score = (v - (q1 + q3) / 2) / iqr;
      return { index: i, value: v, score, isAnomaly: v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr };
    });
  }
  // mad
  const m = mean(series);
  const mad = mean(series.map(v => Math.abs(v - m))) || 1;
  return series.map((v, i) => { const s = (v - m) / mad; return { index: i, value: v, score: s, isAnomaly: Math.abs(s) >= th }; });
}
