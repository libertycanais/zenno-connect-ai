// FEATURE — Marketing Platform · Relationship Graph
// Infers common relationships between assets of the same organization.
// Pure. Deterministic.

import type { PlatformAsset } from "../contracts/assets";
import type { GraphEdge, GraphNode, RelationKind, RelationshipGraph } from "../contracts/graph";

type IdentifiedAsset = PlatformAsset & { id: string; healthScore: number };

export function buildGraph(assets: IdentifiedAsset[]): RelationshipGraph {
  const nodes: GraphNode[] = assets.map((a) => ({
    id: a.id, externalId: a.externalId, provider: a.provider, kind: a.kind,
    name: a.name, healthScore: a.healthScore,
  }));

  const edges: GraphEdge[] = [];
  const byKind: Record<string, IdentifiedAsset[]> = {};
  for (const a of assets) (byKind[a.kind] ??= []).push(a);

  const addEdge = (from: string, to: string, relation: RelationKind, confidence: number) => {
    if (from === to) return;
    edges.push({ from, to, relation, confidence });
  };

  // Google Ads ↔ GA4  — measures
  for (const ga of byKind["ga4_property"] ?? []) {
    for (const ads of byKind["google_ads_account"] ?? []) addEdge(ga.id, ads.id, "measures", 0.7);
  }
  // GSC → GA4 (search_data_for)
  for (const gsc of byKind["gsc_property"] ?? []) {
    for (const ga of byKind["ga4_property"] ?? []) addEdge(gsc.id, ga.id, "search_data_for", 0.6);
  }
  // GTM manages tags across GA4/Ads/Pixel
  for (const gtm of byKind["gtm_container"] ?? []) {
    for (const t of [...(byKind["ga4_property"] ?? []), ...(byKind["google_ads_account"] ?? []), ...(byKind["meta_pixel"] ?? [])]) {
      addEdge(gtm.id, t.id, "manages_tags", 0.5);
    }
  }
  // Merchant feeds Google Ads
  for (const m of byKind["merchant_center"] ?? []) {
    for (const a of byKind["google_ads_account"] ?? []) addEdge(m.id, a.id, "feeds", 0.65);
  }
  // GBP publishes on Search/Maps
  for (const g of byKind["gbp_location"] ?? []) {
    for (const a of byKind["google_ads_account"] ?? []) addEdge(g.id, a.id, "publishes_on", 0.4);
  }
  // Pixel tracks events from Meta Ad Account
  for (const p of byKind["meta_pixel"] ?? []) {
    for (const a of byKind["meta_ad_account"] ?? []) addEdge(p.id, a.id, "tracks_events_from", 0.7);
  }

  return { nodes, edges };
}
