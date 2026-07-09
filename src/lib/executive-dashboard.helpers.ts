// FEATURE P0.5 — Executive Analytics Dashboard
// Helpers puros para cálculo de KPIs, agregações e exportações.
// Sem I/O — 100% testável e reutilizável em server functions.

export type SubscriptionLite = {
  id: string;
  status: string;
  plan: string | null;
  price_cents: number | null;
  created_at: string;
  canceled_at: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
};

export type FinanceLite = {
  kind: "income" | "expense";
  amount: number | string;
  due_date: string;
};

export type LeadLite = {
  status: string;
  created_at: string;
  utm_source?: string | null;
  utm_medium?: string | null;
};

export type ConversionLite = {
  event_name: string;
  value: number | string | null;
  created_at: string;
};

// ---------------- KPIs de billing ----------------

export type BillingKPIs = {
  mrr: number;
  arr: number;
  active: number;
  trialing: number;
  canceledLast30d: number;
  churnRate: number; // 0..1
  ticketMedio: number;
};

const ACTIVE_STATUSES = new Set(["active", "past_due"]);

export function computeBillingKPIs(
  subs: readonly SubscriptionLite[],
  now: Date = new Date(),
): BillingKPIs {
  const active = subs.filter((s) => ACTIVE_STATUSES.has(s.status));
  const trialing = subs.filter((s) => s.status === "trialing").length;
  const mrrCents = active.reduce((sum, s) => sum + (s.price_cents ?? 0), 0);
  const mrr = mrrCents / 100;
  const arr = mrr * 12;
  const cutoff = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const canceledLast30d = subs.filter(
    (s) => s.canceled_at && new Date(s.canceled_at) >= cutoff,
  ).length;
  const denom = active.length + canceledLast30d;
  const churnRate = denom > 0 ? canceledLast30d / denom : 0;
  const ticketMedio = active.length > 0 ? mrr / active.length : 0;
  return {
    mrr: round2(mrr),
    arr: round2(arr),
    active: active.length,
    trialing,
    canceledLast30d,
    churnRate: round4(churnRate),
    ticketMedio: round2(ticketMedio),
  };
}

// ---------------- KPIs de aquisição / conversão ----------------

export type AcquisitionKPIs = {
  leads: number;
  qualificados: number;
  clientes: number;
  conversionRate: number; // clientes / leads
  qualificationRate: number; // qualificados / leads
};

export function computeAcquisitionKPIs(
  leads: readonly LeadLite[],
): AcquisitionKPIs {
  const total = leads.length;
  const qualificados = leads.filter((l) => l.status === "qualificado").length;
  const clientes = leads.filter((l) => l.status === "cliente").length;
  return {
    leads: total,
    qualificados,
    clientes,
    conversionRate: total > 0 ? round4(clientes / total) : 0,
    qualificationRate: total > 0 ? round4(qualificados / total) : 0,
  };
}

// ---------------- CAC / LTV / ROI ----------------

export type UnitEconomics = {
  cac: number;
  ltv: number;
  roi: number;
  paybackMonths: number;
};

export function computeUnitEconomics(input: {
  marketingSpend: number;
  newCustomers: number;
  ticketMedio: number;
  churnRate: number;
}): UnitEconomics {
  const { marketingSpend, newCustomers, ticketMedio, churnRate } = input;
  const cac = newCustomers > 0 ? marketingSpend / newCustomers : 0;
  // LTV clássico: ARPU / churn. Se churn=0, usar horizonte de 24 meses.
  const ltv =
    churnRate > 0 ? ticketMedio / churnRate : ticketMedio * 24;
  const roi = cac > 0 ? (ltv - cac) / cac : 0;
  const paybackMonths = ticketMedio > 0 ? cac / ticketMedio : 0;
  return {
    cac: round2(cac),
    ltv: round2(ltv),
    roi: round4(roi),
    paybackMonths: round2(paybackMonths),
  };
}

// ---------------- Funil de conversão ----------------

export type FunnelStage = { stage: string; count: number; rate: number };

export function buildFunnel(
  leads: readonly LeadLite[],
): FunnelStage[] {
  const total = leads.length;
  const stages = [
    { stage: "novo", key: (l: LeadLite) => l.status === "novo" || l.status === "qualificado" || l.status === "cliente" },
    { stage: "qualificado", key: (l: LeadLite) => l.status === "qualificado" || l.status === "cliente" },
    { stage: "cliente", key: (l: LeadLite) => l.status === "cliente" },
  ];
  return stages.map((s) => {
    const count = leads.filter(s.key).length;
    return { stage: s.stage, count, rate: total > 0 ? round4(count / total) : 0 };
  });
}

// ---------------- Séries temporais ----------------

export type DailyPoint = {
  date: string;
  leads: number;
  conversions: number;
  revenue: number;
};

export function buildDailySeries(
  days: number,
  input: {
    leads: readonly LeadLite[];
    conversions: readonly ConversionLite[];
    finance: readonly FinanceLite[];
  },
  now: Date = new Date(),
): DailyPoint[] {
  const out: DailyPoint[] = [];
  const idx = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    idx.set(key, out.length);
    out.push({ date: key, leads: 0, conversions: 0, revenue: 0 });
  }
  for (const l of input.leads) {
    const k = l.created_at.slice(0, 10);
    const i = idx.get(k);
    if (i !== undefined) out[i].leads++;
  }
  for (const c of input.conversions) {
    const k = c.created_at.slice(0, 10);
    const i = idx.get(k);
    if (i !== undefined) out[i].conversions++;
  }
  for (const t of input.finance) {
    if (t.kind !== "income") continue;
    const k = t.due_date.slice(0, 10);
    const i = idx.get(k);
    if (i === undefined) continue;
    out[i].revenue += Number(t.amount) || 0;
  }
  for (const p of out) p.revenue = round2(p.revenue);
  return out;
}

// ---------------- Agregações por origem (UTM) ----------------

export function groupBySource(
  leads: readonly LeadLite[],
): { source: string; count: number }[] {
  const map = new Map<string, number>();
  for (const l of leads) {
    const key = (l.utm_source ?? "direct").toLowerCase();
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
}

// ---------------- Exportação ----------------

/** Serializa lista de objetos como CSV RFC 4180 (aspas duplas, escape). */
export function toCSV<T extends Record<string, unknown>>(
  rows: readonly T[],
  columns?: readonly (keyof T)[],
): string {
  if (rows.length === 0) return "";
  const cols = (columns ?? (Object.keys(rows[0]) as (keyof T)[])) as (keyof T)[];
  const header = cols.map(String).map(csvCell).join(",");
  const body = rows
    .map((r) => cols.map((c) => csvCell(fmt(r[c]))).join(","))
    .join("\r\n");
  return `${header}\r\n${body}`;
}

/** Excel-compatível via SpreadsheetML 2003 (XML puro, sem dependências). */
export function toExcelXML<T extends Record<string, unknown>>(
  rows: readonly T[],
  columns?: readonly (keyof T)[],
): string {
  const cols = ((columns ?? (rows[0] ? Object.keys(rows[0]) : [])) as (keyof T)[]);
  const escape = (v: string) =>
    v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const cell = (v: unknown) => {
    const s = fmt(v);
    const isNum = typeof v === "number" && Number.isFinite(v);
    return `<Cell><Data ss:Type="${isNum ? "Number" : "String"}">${escape(s)}</Data></Cell>`;
  };
  const headerRow = `<Row>${cols.map((c) => cell(String(c))).join("")}</Row>`;
  const bodyRows = rows.map((r) => `<Row>${cols.map((c) => cell(r[c])).join("")}</Row>`).join("");
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Dashboard"><Table>${headerRow}${bodyRows}</Table></Worksheet>
</Workbook>`;
}

function csvCell(v: string): string {
  if (v.includes(",") || v.includes("\"") || v.includes("\n") || v.includes("\r")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}
function fmt(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function round2(n: number): number { return Math.round(n * 100) / 100; }
function round4(n: number): number { return Math.round(n * 10000) / 10000; }
