import { createFileRoute } from "@tanstack/react-router";
import { TrackingPanel } from "@/components/tracking/TrackingPanel";

export const Route = createFileRoute("/app/google-ads/tracking")({
  component: () => <TrackingPanel source="google" sourceLabel="Google Ads" />,
});
