// Business · Benchmarks oficiais (Meta, Google, SEO, CRO, funnel).
// Fontes públicas agregadas (WordStream, Databox, LinkedIn Reports 2023-2024).
// Ranges pensados por vertical genérica; podem ser sobrepostos por vertical
// específica em versões futuras via BenchmarkSet.overrideBy(vertical).

export type BenchmarkRange = { p25: number; p50: number; p75: number };

export type BenchmarkKey =
  | "meta.ctr"
  | "meta.cpc_cents"
  | "meta.cpm_cents"
  | "meta.cvr"
  | "meta.roas"
  | "google.search.ctr"
  | "google.search.cpc_cents"
  | "google.search.cvr"
  | "google.search.roas"
  | "google.display.ctr"
  | "google.display.cpm_cents"
  | "seo.organic_ctr_position_1"
  | "seo.organic_ctr_position_3"
  | "seo.organic_ctr_position_10"
  | "cro.landing_page_cvr"
  | "cro.checkout_cvr"
  | "funnel.mql_to_sql"
  | "funnel.sql_to_customer"
  | "b2b.cac_ltv_ratio";

export const BENCHMARKS: Record<BenchmarkKey, BenchmarkRange> = {
  "meta.ctr":                   { p25: 0.007, p50: 0.012, p75: 0.022 },
  "meta.cpc_cents":             { p25: 40,   p50: 90,    p75: 220 },
  "meta.cpm_cents":             { p25: 800,  p50: 1600,  p75: 4200 },
  "meta.cvr":                   { p25: 0.009, p50: 0.018, p75: 0.035 },
  "meta.roas":                  { p25: 1.6,  p50: 3.0,   p75: 5.5 },
  "google.search.ctr":          { p25: 0.02, p50: 0.038, p75: 0.065 },
  "google.search.cpc_cents":    { p25: 60,   p50: 180,   p75: 460 },
  "google.search.cvr":          { p25: 0.02, p50: 0.045, p75: 0.09 },
  "google.search.roas":         { p25: 2.0,  p50: 3.8,   p75: 6.2 },
  "google.display.ctr":         { p25: 0.001, p50: 0.005, p75: 0.012 },
  "google.display.cpm_cents":   { p25: 200,  p50: 500,   p75: 1500 },
  "seo.organic_ctr_position_1": { p25: 0.22, p50: 0.28,  p75: 0.32 },
  "seo.organic_ctr_position_3": { p25: 0.08, p50: 0.11,  p75: 0.15 },
  "seo.organic_ctr_position_10":{ p25: 0.015,p50: 0.025, p75: 0.04 },
  "cro.landing_page_cvr":       { p25: 0.011, p50: 0.024, p75: 0.058 },
  "cro.checkout_cvr":           { p25: 0.15, p50: 0.30,  p75: 0.55 },
  "funnel.mql_to_sql":          { p25: 0.10, p50: 0.20,  p75: 0.35 },
  "funnel.sql_to_customer":     { p25: 0.15, p50: 0.25,  p75: 0.40 },
  "b2b.cac_ltv_ratio":          { p25: 3,    p50: 4.5,   p75: 7 },
};

export type BenchmarkComparison = {
  key: BenchmarkKey;
  value: number;
  bucket: "below_p25" | "p25_p50" | "p50_p75" | "above_p75";
  percentileEstimate: number;   // 0..100
  reference: BenchmarkRange;
};

export function compare(key: BenchmarkKey, value: number): BenchmarkComparison {
  const ref = BENCHMARKS[key];
  let bucket: BenchmarkComparison["bucket"] = "below_p25";
  let pct = 12;
  if (value >= ref.p75)      { bucket = "above_p75"; pct = 88; }
  else if (value >= ref.p50) { bucket = "p50_p75";   pct = 62; }
  else if (value >= ref.p25) { bucket = "p25_p50";   pct = 38; }
  return { key, value, bucket, percentileEstimate: pct, reference: ref };
}
