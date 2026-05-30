import { createFileRoute } from "@tanstack/react-router";
import { TrackingPanel } from "@/components/tracking/TrackingPanel";

export const Route = createFileRoute("/app/meta-ads/tracking")({
  component: () => <TrackingPanel source="meta" sourceLabel="Meta Ads" />,
});
