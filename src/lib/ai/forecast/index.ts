// EPIC I — Forecast Engine (contratos + naive/trend)
export type ForecastMetric = "revenue" | "mrr" | "arr" | "cac" | "roas" | "pipeline" | "ltv" | "churn";

export type ForecastPoint = { t: number; value: number };

export type ForecastInput = {
  organizationId: string;
  metric: ForecastMetric;
  history: ForecastPoint[];
  horizon: number; // periods ahead
  method?: "naive" | "trend";
};

export type ForecastOutput = {
  organizationId: string;
  metric: ForecastMetric;
  method: "naive" | "trend";
  forecast: ForecastPoint[];
  confidence: number;
  generatedAt: string;
};

export function forecast(input: ForecastInput): ForecastOutput {
  const method = input.method ?? (input.history.length >= 3 ? "trend" : "naive");
  const last = input.history[input.history.length - 1]?.value ?? 0;
  const points: ForecastPoint[] = [];
  if (method === "naive" || input.history.length < 2) {
    for (let i = 1; i <= input.horizon; i++) points.push({ t: (input.history.at(-1)?.t ?? 0) + i, value: last });
    return { organizationId: input.organizationId, metric: input.metric, method: "naive", forecast: points, confidence: 0.4, generatedAt: new Date().toISOString() };
  }
  // linear regression
  const n = input.history.length;
  const xs = input.history.map((p) => p.t);
  const ys = input.history.map((p) => p.value);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i]! - my), 0);
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0) || 1;
  const slope = num / den;
  const intercept = my - slope * mx;
  const lastT = xs[n - 1]!;
  for (let i = 1; i <= input.horizon; i++) {
    const t = lastT + i;
    points.push({ t, value: intercept + slope * t });
  }
  return { organizationId: input.organizationId, metric: input.metric, method: "trend", forecast: points, confidence: 0.6, generatedAt: new Date().toISOString() };
}
