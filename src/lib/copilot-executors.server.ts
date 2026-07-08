// Server-only: executes real write actions on Meta/Google Ads APIs.
// Never import from a .functions.ts module top-level — use dynamic import inside handlers.

type Supa = any;

function googleAppCreds() {
  const id = process.env.GOOGLE_ADS_CLIENT_ID;
  const secret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  if (!id || !secret) throw new Error("GOOGLE_ADS_CLIENT_ID/SECRET não configurados.");
  return { id, secret };
}
function googleDevToken() {
  const t = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!t) throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN não configurado.");
  return t;
}

async function refreshGoogleToken(refreshToken: string) {
  const { id, secret } = googleAppCreds();
  const body = new URLSearchParams({
    client_id: id, client_secret: secret,
    refresh_token: refreshToken, grant_type: "refresh_token",
  });
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body });
  const j = (await r.json()) as { access_token?: string; expires_in?: number };
  if (!r.ok || !j.access_token) throw new Error("Falha ao renovar token Google.");
  return { token: j.access_token, expiresIn: j.expires_in ?? 3600 };
}

async function ensureGoogleAccessToken(supabase: Supa, accountId: string) {
  const { data: acc, error } = await supabase
    .from("google_ad_accounts")
    .select("id, access_token, refresh_token, token_expires_at, customer_id, manager_customer_id, organization_id")
    .eq("id", accountId).single();
  if (error || !acc) throw new Error("Conta Google não encontrada.");
  const exp = acc.token_expires_at ? new Date(acc.token_expires_at).getTime() : 0;
  if (exp - Date.now() > 60_000 && acc.access_token) return acc;
  if (!acc.refresh_token) throw new Error("Sem refresh token. Reconecte.");
  const { token, expiresIn } = await refreshGoogleToken(acc.refresh_token);
  const newExp = new Date(Date.now() + expiresIn * 1000).toISOString();
  await supabase.from("google_ad_accounts")
    .update({ access_token: token, token_expires_at: newExp }).eq("id", accountId);
  return { ...acc, access_token: token, token_expires_at: newExp };
}

async function ensureMetaAccount(supabase: Supa, accountId: string) {
  const { data: acc, error } = await supabase
    .from("meta_ad_accounts")
    .select("id, access_token, ad_account_id, organization_id")
    .eq("id", accountId).single();
  if (error || !acc) throw new Error("Conta Meta não encontrada.");
  if (!acc.access_token) throw new Error("Sem access token Meta. Reconecte.");
  return acc;
}

// ============ META ============
export async function metaUpdateCampaign(
  supabase: Supa,
  campaignRowId: string,
  patch: { status?: "ACTIVE" | "PAUSED"; daily_budget_cents?: number },
) {
  const { data: camp, error } = await supabase
    .from("meta_campaigns")
    .select("id, external_id, ad_account_id, name, organization_id, status, daily_budget")
    .eq("id", campaignRowId).single();
  if (error || !camp) throw new Error("Campanha Meta não encontrada.");
  const acc = await ensureMetaAccount(supabase, camp.ad_account_id);

  const body: Record<string, string> = { access_token: acc.access_token };
  if (patch.status) body.status = patch.status;
  if (patch.daily_budget_cents != null) body.daily_budget = String(patch.daily_budget_cents);

  const url = `https://graph.facebook.com/v20.0/${camp.external_id}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Meta API: ${j?.error?.message ?? r.statusText}`);

  // reflect locally
  const localPatch: Record<string, unknown> = {};
  if (patch.status) localPatch.status = patch.status;
  if (patch.daily_budget_cents != null) localPatch.daily_budget = patch.daily_budget_cents;
  if (Object.keys(localPatch).length) {
    await supabase.from("meta_campaigns").update(localPatch).eq("id", campaignRowId);
  }
  return { ok: true, campaign: camp.name, result: j };
}

export async function metaCreateCampaign(
  supabase: Supa,
  accountRowId: string,
  input: { name: string; objective: string; daily_budget_cents: number },
) {
  if (!input.name || !input.objective || !(input.daily_budget_cents > 0)) {
    throw new Error("Campos inválidos para criar campanha.");
  }
  const acc = await ensureMetaAccount(supabase, accountRowId);
  const url = `https://graph.facebook.com/v20.0/act_${acc.ad_account_id}/campaigns`;
  const body = new URLSearchParams({
    access_token: acc.access_token,
    name: input.name,
    objective: input.objective,
    status: "PAUSED",
    special_ad_categories: "[]",
    daily_budget: String(input.daily_budget_cents),
  });
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Meta API: ${j?.error?.message ?? r.statusText}`);

  // reflect locally
  await supabase.from("meta_campaigns").insert({
    organization_id: acc.organization_id,
    ad_account_id: acc.id,
    external_id: j.id,
    name: input.name,
    objective: input.objective,
    daily_budget: input.daily_budget_cents,
    status: "PAUSED",
    synced_at: new Date().toISOString(),
  });

  return { ok: true, external_id: j.id, name: input.name };

// ============ GOOGLE ============
export async function googleUpdateCampaignStatus(
  supabase: Supa,
  campaignRowId: string,
  status: "ENABLED" | "PAUSED",
) {
  const { data: camp, error } = await supabase
    .from("google_ads_campaigns")
    .select("id, external_id, account_id, name, organization_id")
    .eq("id", campaignRowId).single();
  if (error || !camp) throw new Error("Campanha Google não encontrada.");
  const acc = await ensureGoogleAccessToken(supabase, camp.account_id);

  const url = `https://googleads.googleapis.com/v17/customers/${acc.customer_id}/campaigns:mutate`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${acc.access_token}`,
    "developer-token": googleDevToken(),
    "Content-Type": "application/json",
  };
  if (acc.manager_customer_id) headers["login-customer-id"] = acc.manager_customer_id;

  const payload = {
    operations: [{
      update: {
        resourceName: `customers/${acc.customer_id}/campaigns/${camp.external_id}`,
        status,
      },
      updateMask: "status",
    }],
  };
  const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
  const j = await r.json();
  if (!r.ok) throw new Error(`Google Ads API: ${JSON.stringify(j).slice(0, 300)}`);

  await supabase.from("google_ads_campaigns").update({ status }).eq("id", campaignRowId);
  return { ok: true, campaign: camp.name, result: j };
}

export async function googleUpdateCampaignBudget(
  supabase: Supa,
  campaignRowId: string,
  amountMicros: number,
) {
  // Google Ads: budget lives on campaign_budget resource; we need to find it.
  const { data: camp, error } = await supabase
    .from("google_ads_campaigns")
    .select("id, external_id, account_id, name, organization_id")
    .eq("id", campaignRowId).single();
  if (error || !camp) throw new Error("Campanha Google não encontrada.");
  const acc = await ensureGoogleAccessToken(supabase, camp.account_id);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${acc.access_token}`,
    "developer-token": googleDevToken(),
    "Content-Type": "application/json",
  };
  if (acc.manager_customer_id) headers["login-customer-id"] = acc.manager_customer_id;

  // 1. discover budget resource
  const query = `SELECT campaign.campaign_budget FROM campaign WHERE campaign.id = ${camp.external_id}`;
  const sr = await fetch(
    `https://googleads.googleapis.com/v17/customers/${acc.customer_id}/googleAds:search`,
    { method: "POST", headers, body: JSON.stringify({ query }) },
  );
  const sj = await sr.json();
  if (!sr.ok) throw new Error(`Google Ads search: ${JSON.stringify(sj).slice(0, 300)}`);
  const budgetResource: string | undefined = sj.results?.[0]?.campaign?.campaignBudget;
  if (!budgetResource) throw new Error("Budget da campanha não encontrado.");

  // 2. mutate budget
  const url = `https://googleads.googleapis.com/v17/customers/${acc.customer_id}/campaignBudgets:mutate`;
  const payload = {
    operations: [{
      update: { resourceName: budgetResource, amountMicros: String(amountMicros) },
      updateMask: "amount_micros",
    }],
  };
  const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
  const j = await r.json();
  if (!r.ok) throw new Error(`Google Ads budget mutate: ${JSON.stringify(j).slice(0, 300)}`);

  await supabase.from("google_ads_campaigns")
    .update({ budget_amount: amountMicros / 1_000_000 }).eq("id", campaignRowId);
  return { ok: true, campaign: camp.name, result: j };
}
