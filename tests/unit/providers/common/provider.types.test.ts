import { describe, expect, it } from "vitest";
import {
  ProviderError,
  ProviderNotConfiguredError,
  UnknownProviderError,
  sanitizeProviderError,
} from "@/providers/common/provider.types";

describe("provider common types", () => {
  describe("ProviderError", () => {
    it("prefixes message with provider and code", () => {
      const err = new ProviderError("meta", "boom", "something broke");
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe("ProviderError");
      expect(err.provider).toBe("meta");
      expect(err.code).toBe("boom");
      expect(err.message).toBe("[meta:boom] something broke");
    });

    it("preserves optional cause", () => {
      const cause = new Error("root");
      const err = new ProviderError("meta", "x", "y", cause);
      expect(err.cause).toBe(cause);
    });
  });

  describe("ProviderNotConfiguredError", () => {
    it("lists missing env keys", () => {
      const err = new ProviderNotConfiguredError("stripe", ["STRIPE_SECRET_KEY"]);
      expect(err).toBeInstanceOf(ProviderError);
      expect(err.code).toBe("not_configured");
      expect(err.message).toContain("Missing config: STRIPE_SECRET_KEY");
      expect(err.name).toBe("ProviderNotConfiguredError");
    });

    it("supports multiple missing keys", () => {
      const err = new ProviderNotConfiguredError("google_ads", [
        "GOOGLE_ADS_CLIENT_ID",
        "GOOGLE_ADS_DEVELOPER_TOKEN",
      ]);
      expect(err.message).toContain("GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_DEVELOPER_TOKEN");
    });
  });

  describe("UnknownProviderError", () => {
    it("lists supported providers", () => {
      const err = new UnknownProviderError("ads", "yahoo", ["meta", "google_ads"]);
      expect(err).toBeInstanceOf(ProviderError);
      expect(err.code).toBe("unknown_provider");
      expect(err.message).toContain('Unknown ads provider "yahoo"');
      expect(err.message).toContain("meta, google_ads");
    });
  });

  describe("sanitizeProviderError", () => {
    it("redacts bearer tokens (any casing)", () => {
      const err = new Error("failed with Bearer abc.DEF-123_xyz on request");
      expect(sanitizeProviderError(err)).toContain("[REDACTED]");
      expect(sanitizeProviderError(err)).not.toContain("abc.DEF-123_xyz");
    });

    it("returns ProviderError.message unchanged (already safe by construction)", () => {
      const err = new ProviderError("meta", "boom", "safe");
      expect(sanitizeProviderError(err)).toBe("[meta:boom] safe");
    });

    it("falls back to generic label for non-Error inputs", () => {
      expect(sanitizeProviderError(undefined)).toBe("provider_error");
      expect(sanitizeProviderError(null)).toBe("provider_error");
      expect(sanitizeProviderError({ oops: 1 })).toBe("provider_error");
      expect(sanitizeProviderError("raw string")).toBe("provider_error");
    });

    it.each([
      "authorization: Bearer super-secret-token",
      "Bearer eyJhbGciOiJIUzI1NiJ9.abc.def",
      "BEARER 123456",
    ])("redacts %p", (input) => {
      const out = sanitizeProviderError(new Error(input));
      expect(out.toLowerCase()).toContain("bearer");
      expect(out).toContain("[REDACTED]");
    });

    it("does not leak sensitive raw tokens via ProviderError constructed with safe messages", () => {
      // Contract: consumers must NEVER pass raw secrets into ProviderError messages.
      // This test documents/asserts the safe pattern.
      const err = new ProviderError("meta", "token_exchange_failed", "token_failed");
      const forbidden = [
        "Authorization",
        "Bearer",
        "sk_live_",
        "service_role",
        "refresh_token",
        "password",
      ];
      for (const needle of forbidden) {
        expect(err.message).not.toContain(needle);
      }
    });
  });
});
