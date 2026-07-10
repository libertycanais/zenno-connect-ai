// FEATURE — Marketing Platform Connector · Relationship graph contracts
import type { AssetKind } from "./assets";

export type RelationKind =
  | "measures"           // GA4 measures Google Ads
  | "manages_tags"       // GTM manages tags on GA4/Ads/Pixel
  | "search_data_for"    // GSC provides search data for GA4
  | "feeds"              // Merchant feeds Google Ads shopping
  | "publishes_on"       // GBP publishes on Search/Maps
  | "tracks_events_from" // Pixel/CAPI tracks events from Ad Account
  | "sibling_of";

export type GraphNode = {
  id: string;                 // asset id
  externalId: string;
  provider: string;
  kind: AssetKind;
  name: string;
  healthScore: number;
};

export type GraphEdge = {
  from: string;
  to: string;
  relation: RelationKind;
  confidence: number;
};

export type RelationshipGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};
