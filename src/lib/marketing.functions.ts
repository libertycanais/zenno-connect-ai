// FEATURE — Marketing Platform · Server Functions (auth-required)
// Client-safe module: import from routes/components. All handlers run server-side.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import type { MarketingProvider, PlatformAsset } from "./marketing";
import {
  getConnector,
  listProviders,
  getCapability,
  discoverPlatformAssets,
  buildGraph,
  scoreAsset,
  buildSlice,
  makeTimelineEvent,
} from "./marketing";

const providerSchema = z.enum(["google", "meta", "tiktok", "linkedin", "microsoft"]);

// ── Registry (read-only, safe to expose) ────────────────────────────────────
export const listMarketingProviders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ providers: listProviders() }));

// ── Start OAuth ─────────────────────────────────────────────────────────────
export const startMarketingConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ provider: providerSchema, redirectAfter: z.string().max(255).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { issueState } = await import("./marketing/marketing-security.server");
    const { supabase, userId } = context;
    const { data: prof } = await supabase.from("profiles").select("organization_id").eq("id", userId).single();
    if (!prof?.organization_id) throw new Error("Organização não encontrada.");

    const cap = getCapability(data.provider);
    if (!cap.enabled || !cap.oauthAuthorizeUrl) {
      throw new Error(`Provider ${data.provider} ainda não está habilitado.`);
    }

    const { state, hash } = issueState();
    const { error: insErr } = await supabase.from("marketing_oauth_states").insert({
      state_hash: hash,
      provider: data.provider,
      organization_id: prof.organization_id,
      user_id: userId,
      redirect_after: data.redirectAfter ?? "/app/marketing",
    });
    if (insErr) throw new Error(insErr.message);

    const baseUrl = process.env.APP_BASE_URL || "https://zenno-connect-ai.lovable.app";
    const redirectUri = `${baseUrl}/api/public/marketing/oauth/callback`;

    const connector = getConnector(data.provider);
    const { authorizeUrl } = await connector.connect(
      { organizationId: prof.organization_id, userId },
      { state, redirectUri, scopes: cap.scopes },
    );
    return { url: authorizeUrl };
  });

// ── Connections list ────────────────────────────────────────────────────────
export const listMarketingConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("marketing_connections")
      .select("id, provider, status, display_name, scopes, last_health_score, last_health_status, last_health_at, token_expires_at, last_error, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { connections: data ?? [] };
  });

// ── Disconnect ──────────────────────────────────────────────────────────────
export const disconnectMarketingConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("marketing_connections")
      .update({ status: "revoked" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Discover assets for a connection ────────────────────────────────────────
export const discoverConnectionAssets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ connectionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { decryptToken } = await import("./marketing/marketing-security.server");
    const { supabase, userId } = context;

    const { data: conn, error: e1 } = await supabase
      .from("marketing_connections")
      .select("id, organization_id, provider, credentials_ciphertext, credentials_nonce, refresh_ciphertext, refresh_nonce, token_expires_at, scopes")
      .eq("id", data.connectionId).single();
    if (e1 || !conn) throw new Error("Conexão não encontrada.");
    if (!conn.credentials_ciphertext || !conn.credentials_nonce) throw new Error("Tokens ausentes.");

    const accessToken = decryptToken(conn.credentials_ciphertext, conn.credentials_nonce);
    const refreshToken = conn.refresh_ciphertext && conn.refresh_nonce
      ? decryptToken(conn.refresh_ciphertext, conn.refresh_nonce) : null;

    const provider = conn.provider as MarketingProvider;
    const result = await discoverPlatformAssets(provider, {
      accessToken, refreshToken, expiresAt: conn.token_expires_at, scopes: conn.scopes ?? [],
    }, { organizationId: conn.organization_id, userId, connectionId: conn.id });

    // Upsert assets
    const rows = result.assets.map((a: PlatformAsset) => ({
      organization_id: conn.organization_id,
      connection_id: conn.id,
      provider: a.provider,
      asset_kind: a.kind,
      external_id: a.externalId,
      parent_external_id: a.parentExternalId ?? null,
      name: a.name,
      currency: a.currency ?? null,
      timezone: a.timezone ?? null,
      capabilities: (a.capabilities ?? {}) as unknown as Json,
      raw: (a.raw ?? {}) as unknown as Json,
    }));
    if (rows.length) {
      const { error } = await supabase
        .from("marketing_assets")
        .upsert(rows, { onConflict: "connection_id,asset_kind,external_id" });
      if (error) throw new Error(error.message);
    }

    // Timeline
    if (result.timeline?.length) {
      const tlRows = result.timeline.map((t) => ({
        organization_id: t.organizationId,
        connection_id: t.connectionId,
        asset_id: t.assetId,
        provider: t.provider,
        event_type: t.eventType,
        severity: t.severity,
        payload: t.payload,
        occurred_at: t.occurredAt,
      }));
      await supabase.from("marketing_timeline_events").insert(tlRows);
    }

    return { discovered: rows.length };
  });

// ── List assets ─────────────────────────────────────────────────────────────
export const listMarketingAssets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("marketing_assets")
      .select("id, connection_id, provider, asset_kind, external_id, name, currency, timezone, health_score, health_status, last_synced_at, capabilities")
      .order("provider", { ascending: true });
    if (error) throw new Error(error.message);
    return { assets: data ?? [] };
  });

// ── Bind / unbind asset ─────────────────────────────────────────────────────
export const bindMarketingAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ assetId: z.string().uuid(), purpose: z.string().min(1).max(64).default("primary") }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: asset, error: e1 } = await supabase.from("marketing_assets").select("id, organization_id").eq("id", data.assetId).single();
    if (e1 || !asset) throw new Error("Ativo não encontrado.");
    const { error } = await supabase.from("marketing_asset_bindings").upsert({
      organization_id: asset.organization_id, asset_id: asset.id, purpose: data.purpose, bound_by: userId, unbound_at: null,
    }, { onConflict: "asset_id,purpose" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unbindMarketingAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ bindingId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("marketing_asset_bindings").update({ unbound_at: new Date().toISOString() }).eq("id", data.bindingId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Health overview ─────────────────────────────────────────────────────────
export const getMarketingHealthOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: assets, error } = await context.supabase
      .from("marketing_assets")
      .select("id, provider, asset_kind, name, health_score, health_status, last_synced_at, capabilities");
    if (error) throw new Error(error.message);

    const byProvider: Record<string, { count: number; scoreSum: number; online: number; warning: number; offline: number }> = {};
    for (const a of assets ?? []) {
      const p = a.provider;
      byProvider[p] ??= { count: 0, scoreSum: 0, online: 0, warning: 0, offline: 0 };
      byProvider[p].count += 1;
      byProvider[p].scoreSum += a.health_score ?? 0;
      const s = a.health_status as "online" | "warning" | "offline" | "unknown";
      if (s === "online") byProvider[p].online += 1;
      else if (s === "warning") byProvider[p].warning += 1;
      else if (s === "offline") byProvider[p].offline += 1;
    }
    const overview = Object.entries(byProvider).map(([provider, s]) => ({
      provider, count: s.count, avgScore: s.count ? Math.round(s.scoreSum / s.count) : 0,
      online: s.online, warning: s.warning, offline: s.offline,
    }));
    return { overview, assets: assets ?? [] };
  });

// ── Timeline ────────────────────────────────────────────────────────────────
export const getMarketingTimeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ limit: z.number().int().min(1).max(200).default(50) }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("marketing_timeline_events")
      .select("id, provider, event_type, severity, payload, occurred_at, connection_id, asset_id")
      .order("occurred_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { events: rows ?? [] };
  });

// ── Relationship graph ──────────────────────────────────────────────────────
export const getMarketingGraph = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: assets, error } = await context.supabase
      .from("marketing_assets")
      .select("id, provider, asset_kind, external_id, parent_external_id, name, capabilities, health_score");
    if (error) throw new Error(error.message);
    const identified = (assets ?? []).map((a) => ({
      id: a.id, provider: a.provider as MarketingProvider, kind: a.asset_kind as PlatformAsset["kind"],
      externalId: a.external_id, parentExternalId: a.parent_external_id ?? null,
      name: a.name ?? a.external_id, capabilities: (a.capabilities as Record<string, boolean | string | number>) ?? {},
      healthScore: a.health_score ?? 0,
    }));
    return { graph: buildGraph(identified) };
  });

// ── Recompute health (batch) ────────────────────────────────────────────────
export const recomputeMarketingHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: assets, error } = await context.supabase
      .from("marketing_assets")
      .select("id, provider, asset_kind, external_id, name, capabilities, last_synced_at");
    if (error) throw new Error(error.message);
    let updated = 0;
    for (const a of assets ?? []) {
      const h = scoreAsset({
        asset: {
          provider: a.provider as MarketingProvider,
          kind: a.asset_kind as PlatformAsset["kind"],
          externalId: a.external_id,
          name: a.name ?? a.external_id,
          capabilities: (a.capabilities as Record<string, boolean | string | number>) ?? {},
        },
        lastSyncedAt: a.last_synced_at,
        lastError: null,
      });
      await context.supabase.from("marketing_assets").update({
        health_score: h.score, health_status: h.status, health_reasons: h.reasons,
      }).eq("id", a.id);
      updated += 1;
    }
    return { updated };
  });

// ── Refresh AI Marketing Context slice ──────────────────────────────────────
export const refreshMarketingContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: conns } = await context.supabase
      .from("marketing_connections")
      .select("id, provider, created_at, last_health_score");
    const { data: bindings } = await context.supabase
      .from("marketing_asset_bindings")
      .select("id, asset_id, marketing_assets(name, asset_kind, external_id, connection_id)")
      .is("unbound_at", null);
    const entries = (conns ?? []).map((c) => {
      const bound = (bindings ?? [])
        .filter((b) => {
          const asset = b.marketing_assets as unknown as { connection_id?: string } | null;
          return asset?.connection_id === c.id;
        })
        .map((b) => {
          const asset = b.marketing_assets as unknown as { name?: string; asset_kind?: string; external_id?: string };
          return { kind: asset?.asset_kind ?? "", name: asset?.name ?? "", externalId: asset?.external_id ?? "" };
        });
      return {
        provider: c.provider as MarketingProvider,
        connectedAt: c.created_at,
        assetCount: bound.length,
        healthScore: c.last_health_score ?? 0,
        boundAssets: bound,
      };
    });
    const slice = buildSlice(entries);
    // Emit timeline event (informational)
    await context.supabase.from("marketing_timeline_events").insert({
      organization_id: (await context.supabase.from("profiles").select("organization_id").eq("id", context.userId).single()).data?.organization_id,
      ...makeTimelineEvent({
        organizationId: "", // rewritten above
        eventType: "discovery.completed",
        severity: "info",
        payload: { context_refreshed: true, providers: slice.connectedProviders.length },
      }),
      event_type: "discovery.completed",
    });
    return { slice };
  });
