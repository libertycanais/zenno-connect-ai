/**
 * Global test setup — carregado antes de cada arquivo de teste.
 * Registra matchers do jest-dom, mocks globais e polyfills.
 */
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Cleanup React Testing Library após cada teste.
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Env determinística — nunca vaza secrets reais para testes.
beforeAll(() => {
  process.env.SERVICE_NAME = "zenno-api-test";
  process.env.APP_ENV = "test";
  process.env.APP_VERSION = "test";
  process.env.ADS_PROVIDER = process.env.ADS_PROVIDER ?? "meta";
  process.env.WHATSAPP_PROVIDER = process.env.WHATSAPP_PROVIDER ?? "uazapi";
  process.env.PAYMENT_PROVIDER = process.env.PAYMENT_PROVIDER ?? "stripe";
  process.env.AI_PROVIDER = process.env.AI_PROVIDER ?? "lovable";
});

// matchMedia é usado por componentes shadcn/radix.
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

// IntersectionObserver / ResizeObserver stubs.
class MockObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
}
// @ts-expect-error jsdom lacks these globals
globalThis.IntersectionObserver ??= MockObserver as unknown as typeof IntersectionObserver;
// @ts-expect-error jsdom lacks these globals
globalThis.ResizeObserver ??= MockObserver as unknown as typeof ResizeObserver;
