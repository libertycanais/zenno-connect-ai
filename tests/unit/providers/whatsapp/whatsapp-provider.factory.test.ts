import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getWhatsAppProvider,
  listWhatsAppProviders,
} from "@/providers/whatsapp/whatsapp-provider.factory";
import { UazapiProvider } from "@/providers/whatsapp/uazapi.provider";
import { UnknownProviderError } from "@/providers/common/provider.types";

describe("whatsapp-provider.factory", () => {
  beforeEach(() => vi.unstubAllEnvs());
  afterEach(() => vi.unstubAllEnvs());

  it("registers uazapi", () => {
    expect(listWhatsAppProviders()).toContain("uazapi");
  });

  it("defaults to uazapi", () => {
    vi.stubEnv("WHATSAPP_PROVIDER", "");
    expect(getWhatsAppProvider()).toBeInstanceOf(UazapiProvider);
  });

  it("explicit arg overrides env", () => {
    vi.stubEnv("WHATSAPP_PROVIDER", "unknown");
    expect(getWhatsAppProvider("uazapi")).toBeInstanceOf(UazapiProvider);
  });

  it("throws UnknownProviderError for unregistered", () => {
    expect(() => getWhatsAppProvider("whatsapp-cloud")).toThrow(UnknownProviderError);
  });
});
