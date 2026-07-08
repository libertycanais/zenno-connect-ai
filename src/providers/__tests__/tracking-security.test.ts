import { describe, expect, it } from "vitest";
import {
  corsFor,
  normalizeAllowedOrigins,
  originAllowed,
  trackingOriginDecision,
  trackingRateLimitKeys,
} from "../../lib/tracking-security";

describe("tracking security hardening", () => {
  it("blocks when allowed origins are empty or null", () => {
    expect(trackingOriginDecision("example.com", null)).toEqual({
      allowed: false,
      normalizedAllowedOrigins: [],
      reason: "missing_allowed_origins",
    });
    expect(trackingOriginDecision("example.com", [])).toEqual({
      allowed: false,
      normalizedAllowedOrigins: [],
      reason: "missing_allowed_origins",
    });
  });

  it("blocks server-to-server requests without origin or referer host", () => {
    expect(trackingOriginDecision(null, ["example.com"])).toEqual({
      allowed: false,
      normalizedAllowedOrigins: ["example.com"],
      reason: "missing_request_origin",
    });
  });

  it("normalizes origin allowlists before matching", () => {
    expect(
      normalizeAllowedOrigins([
        " HTTPS://Example.COM/path ",
        "example.com",
        "invalid",
        "*.Shop.Example.com/checkout",
      ]),
    ).toEqual(["*.shop.example.com", "example.com"]);
  });

  it("allows exact and wildcard host matches only", () => {
    expect(originAllowed("example.com", ["https://example.com/path"])).toBe(true);
    expect(originAllowed("shop.example.com", ["*.example.com"])).toBe(true);
    expect(originAllowed("evil-example.com", ["*.example.com"])).toBe(false);
    expect(originAllowed("attacker.com", ["example.com"])).toBe(false);
  });

  it("never emits wildcard CORS for tracking events", () => {
    expect(corsFor(null)).not.toHaveProperty("Access-Control-Allow-Origin");
    expect(corsFor("https://example.com")["Access-Control-Allow-Origin"]).toBe(
      "https://example.com",
    );
  });

  it("builds separate botnet-resistant limiter keys for ip and public key", () => {
    expect(trackingRateLimitKeys("org-1", "pk_live", "203.0.113.10")).toEqual({
      ipKey: "tracking:event:ip:org-1:pk_live:203.0.113.10",
      publicKeyKey: "tracking:event:pk:org-1:pk_live",
    });
  });
});
