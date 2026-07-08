import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Sprint 5.2 — Performance Optimization (additive, per PERFORMANCE_AUDIT §2.6 / §5)
  // Sensible defaults reduce duplicate refetches across routes without changing
  // any contract. Per-query overrides remain the source of truth when set.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000, // 30s: dedup across route/component re-mounts
        gcTime: 5 * 60_000, // 5min: keep unused cache warm for back-navigation
        refetchOnWindowFocus: false,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
