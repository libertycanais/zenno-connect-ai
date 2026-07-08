import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

/**
 * Sprint 4 — Enterprise Test Suite
 *
 * Configuração dedicada de Vitest, isolada do vite.config.ts principal
 * (que é gerenciado por @lovable.dev/vite-tanstack-config e não deve ser
 * tocado). Aditivo: nenhum código de produção é afetado.
 */
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@tests": path.resolve(__dirname, "./tests"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: [
      "tests/unit/**/*.{test,spec}.{ts,tsx}",
      "tests/integration/**/*.{test,spec}.{ts,tsx}",
      "tests/contracts/**/*.{test,spec}.{ts,tsx}",
      "src/**/__tests__/**/*.{test,spec}.{ts,tsx}",
    ],
    exclude: [
      "node_modules/**",
      "dist/**",
      ".output/**",
      ".lovable/**",
      "supabase/functions/**",
    ],
    css: false,
    testTimeout: 10_000,
    hookTimeout: 10_000,
    reporters: ["default"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      include: [
        "src/lib/**/*.ts",
        "src/providers/**/*.ts",
        "src/routes/api/public/**/*.ts",
      ],
      exclude: [
        "**/*.d.ts",
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/__tests__/**",
        "src/integrations/supabase/**",
        "src/routeTree.gen.ts",
      ],
      thresholds: {
        // WS-9 — thresholds enforced in CI. Values reflect current baseline
        // across the whole include[] surface (src/lib, src/providers,
        // src/routes/api/public — including *.functions.ts not yet covered).
        // Raise as coverage grows; do NOT lower without explicit review.
        lines: 20,
        functions: 20,
        branches: 20,
        statements: 20,
      },
    },
    // WS-9 — safe parallelization: each test file runs in an isolated
    // worker context, preventing shared-mock leaks between suites.
    isolate: true,
  },
});
