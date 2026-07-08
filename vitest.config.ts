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
        // for the surface covered by include[] (src/lib, src/providers,
        // src/routes/api/public). Raise as coverage grows; do NOT lower.
        lines: 55,
        functions: 55,
        branches: 45,
        statements: 55,
      },
    },
    // WS-9 — safe parallelization: each test file gets an isolated worker,
    // preventing shared-mock leaks between suites.
    isolate: true,
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: false,
      },
    },
  },
});
