// Trend Engine — linear regression slope + direction (pure).
export type TrendDirection = "up" | "down" | "flat";
export type TrendResult = {
  slope: number; intercept: number; direction: TrendDirection;
  changePercent: number; r2: number;
};

export function computeTrend(series: number[]): TrendResult {
  const n = series.length;
  if (n < 2) return { slope: 0, intercept: series[0] ?? 0, direction: "flat", changePercent: 0, r2: 0 };
  const xs = series.map((_, i) => i);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = series.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0, totSS = 0, resSS = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - meanX) * (series[i] - meanY); den += (xs[i] - meanX) ** 2; }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;
  for (let i = 0; i < n; i++) {
    const pred = intercept + slope * xs[i];
    totSS += (series[i] - meanY) ** 2;
    resSS += (series[i] - pred) ** 2;
  }
  const r2 = totSS === 0 ? 1 : 1 - resSS / totSS;
  const first = series[0] || 1;
  const last = series[n - 1];
  const changePercent = (last - first) / Math.abs(first || 1);
  const direction: TrendDirection = Math.abs(changePercent) < 0.02 ? "flat" : changePercent > 0 ? "up" : "down";
  return { slope, intercept, direction, changePercent, r2 };
}
