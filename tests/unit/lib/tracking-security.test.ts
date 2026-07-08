import { describe, expect, it } from "vitest";
import {
  corsFor,
  hostOf,
  normalizeAllowedOrigin,
  normalizeAllowedOrigins,
  originAllowed,
  safeTrackingAuditData,
  trackingBaseCors,
  trackingOriginDecision,
  trackingRateLimitKeys,
  TRACKING_IP_RATE_LIMIT_PER_MINUTE,
  TRACKING_PUBLIC_KEY_RATE_LIMIT_PER_MINUTE,
} from "@/lib/tracking-security";

describe("tracking-security — normalizeAllowedOrigin", () => {
  it("accepts bare apex domain", () => {
    expect(normalizeAllowedOrigin("example.com")).toBe("example.com");
  });

  it("strips protocol http/https", () => {
    expect(normalizeAllowedOrigin("https://example.com")).toBe("example.com");
    expect(normalizeAllowedOrigin("http://example.com")).toBe("example.com");
  });

  it("strips path / trailing slash / query", () => {
    expect(normalizeAllowedOrigin("https://example.com/")).toBe("example.com");
    expect(normalizeAllowedOrigin("https://example.com/checkout?x=1")).toBe("example.com");
  });

  it("lowercases and trims whitespace", () => {
    expect(normalizeAllowedOrigin("  HTTPS://Example.COM  ")).toBe("example.com");
  });

  it("preserves valid wildcard subdomain (*.host)", () => {
    expect(normalizeAllowedOrigin("*.example.com")).toBe("*.example.com");
    expect(normalizeAllowedOrigin("*.SHOP.example.com")).toBe("*.shop.example.com");
  });

  it("rejects malformed entries", () => {
    expect(normalizeAllowedOrigin("")).toBeNull();
    expect(normalizeAllowedOrigin("   ")).toBeNull();
    expect(normalizeAllowedOrigin("invalid")).toBeNull(); // no TLD
    expect(normalizeAllowedOrigin("http://")).toBeNull();
    expect(normalizeAllowedOrigin("*.*.example.com")).toBeNull();
    expect(normalizeAllowedOrigin("**example.com")).toBeNull();
    expect(normalizeAllowedOrigin("under_score.com")).toBeNull();
  });

  it("rejects raw IP addresses (not host pattern)", () => {
    // pattern requires .[a-z]{2,} — IPs fail
    expect(normalizeAllowedOrigin("127.0.0.1")).toBeNull();
    expect(normalizeAllowedOrigin("http://192.168.0.1")).toBeNull();
  });

  it("rejects localhost (no TLD)", () => {
    expect(normalizeAllowedOrigin("localhost")).toBeNull();
    expect(normalizeAllowedOrigin("http://localhost")).toBeNull();
  });

  it("strips port implicitly by treating :port as invalid TLD segment", () => {
    // "example.com:3000" fails the TLD anchor — safer to require pure hostnames
    expect(normalizeAllowedOrigin("example.com:3000")).toBeNull();
  });
});

describe("tracking-security — normalizeAllowedOrigins (list)", () => {
  it("returns [] for null / undefined / empty", () => {
    expect(normalizeAllowedOrigins(null)).toEqual([]);
    expect(normalizeAllowedOrigins(undefined)).toEqual([]);
    expect(normalizeAllowedOrigins([])).toEqual([]);
  });

  it("deduplicates case-insensitively and sorts", () => {
    expect(
      normalizeAllowedOrigins([
        "Example.com",
        "example.com",
        "https://example.com/",
        "*.shop.example.com",
      ]),
    ).toEqual(["*.shop.example.com", "example.com"]);
  });

  it("silently drops invalid entries", () => {
    expect(
      normalizeAllowedOrigins(["good.com", "invalid", "", "http://localhost", "bad.io"]),
    ).toEqual(["bad.io", "good.com"]);
  });

  it("handles extra whitespace between duplicates", () => {
    expect(normalizeAllowedOrigins(["  example.com  ", "example.com"])).toEqual([
      "example.com",
    ]);
  });
});

describe("tracking-security — originAllowed", () => {
  it("returns false when reqHost is null", () => {
    expect(originAllowed(null, ["example.com"])).toBe(false);
  });

  it("returns false when allowlist is empty", () => {
    expect(originAllowed("example.com", [])).toBe(false);
  });

  it("exact match", () => {
    expect(originAllowed("example.com", ["example.com"])).toBe(true);
  });

  it("case-insensitive via normalization on the allowlist side", () => {
    expect(originAllowed("example.com", ["Example.COM"])).toBe(true);
  });

  it("wildcard matches subdomain", () => {
    expect(originAllowed("shop.example.com", ["*.example.com"])).toBe(true);
    expect(originAllowed("a.b.example.com", ["*.example.com"])).toBe(true);
  });

  it("wildcard ALSO matches the apex (per implementation)", () => {
    // "*.example.com".slice(2) === "example.com"
    expect(originAllowed("example.com", ["*.example.com"])).toBe(true);
  });

  it("does not match sibling domains that share a suffix substring", () => {
    expect(originAllowed("evil-example.com", ["*.example.com"])).toBe(false);
    expect(originAllowed("attacker.com", ["example.com"])).toBe(false);
  });

  it("does not honor requester-supplied Origin header spoofing when host mismatches allowlist", () => {
    // hostOf(Origin) must be extracted before calling; spoofed values that don't match are rejected.
    expect(originAllowed("attacker.com", ["shop.example.com", "*.example.com"])).toBe(false);
  });
});

describe("tracking-security — trackingOriginDecision", () => {
  it("blocks when allowlist is null or empty", () => {
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

  it("blocks when allowlist has only invalid entries", () => {
    const d = trackingOriginDecision("example.com", ["invalid", "localhost"]);
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toBe("missing_allowed_origins");
  });

  it("blocks server-to-server requests (no reqHost)", () => {
    expect(trackingOriginDecision(null, ["example.com"])).toEqual({
      allowed: false,
      normalizedAllowedOrigins: ["example.com"],
      reason: "missing_request_origin",
    });
  });

  it("blocks reqHost not on allowlist", () => {
    expect(trackingOriginDecision("evil.com", ["example.com"])).toEqual({
      allowed: false,
      normalizedAllowedOrigins: ["example.com"],
      reason: "origin_not_allowed",
    });
  });

  it("allows exact match", () => {
    expect(trackingOriginDecision("example.com", ["example.com"])).toEqual({
      allowed: true,
      normalizedAllowedOrigins: ["example.com"],
    });
  });

  it("allows wildcard subdomain", () => {
    const d = trackingOriginDecision("shop.example.com", ["*.example.com"]);
    expect(d.allowed).toBe(true);
    if (d.allowed) expect(d.normalizedAllowedOrigins).toEqual(["*.example.com"]);
  });
});

describe("tracking-security — hostOf", () => {
  it("extracts hostname (lowercased)", () => {
    expect(hostOf("https://Example.com/path?q=1")).toBe("example.com");
    expect(hostOf("http://sub.example.com")).toBe("sub.example.com");
  });

  it("returns null for null/malformed URLs", () => {
    expect(hostOf(null)).toBeNull();
    expect(hostOf("not-a-url")).toBeNull();
    expect(hostOf("://broken")).toBeNull();
  });
});

describe("tracking-security — corsFor", () => {
  it("includes base cors and Vary: Origin", () => {
    const c = corsFor("https://example.com");
    expect(c.Vary).toBe("Origin");
    expect(c["Access-Control-Allow-Methods"]).toBe("POST, OPTIONS");
    expect(c["Access-Control-Allow-Headers"]).toBe("Content-Type");
    expect(c["Access-Control-Max-Age"]).toBe("600");
  });

  it("echoes the request Origin (never *) when provided", () => {
    expect(corsFor("https://shop.example.com")["Access-Control-Allow-Origin"]).toBe(
      "https://shop.example.com",
    );
  });

  it("omits Access-Control-Allow-Origin when no origin (server-to-server)", () => {
    const c = corsFor(null);
    expect(c).not.toHaveProperty("Access-Control-Allow-Origin");
    expect(c.Vary).toBe("Origin");
  });

  it("does not mutate trackingBaseCors", () => {
    const before = { ...trackingBaseCors };
    corsFor("https://a.com");
    corsFor(null);
    expect({ ...trackingBaseCors }).toEqual(before);
  });
});

describe("tracking-security — rate limit keys + audit data", () => {
  it("builds distinct ip/publicKey keys", () => {
    expect(trackingRateLimitKeys("org1", "pk_abc", "1.2.3.4")).toEqual({
      ipKey: "tracking:event:ip:org1:pk_abc:1.2.3.4",
      publicKeyKey: "tracking:event:pk:org1:pk_abc",
    });
  });

  it("exposes sane default limits", () => {
    expect(TRACKING_IP_RATE_LIMIT_PER_MINUTE).toBeGreaterThan(0);
    expect(TRACKING_PUBLIC_KEY_RATE_LIMIT_PER_MINUTE).toBeGreaterThan(
      TRACKING_IP_RATE_LIMIT_PER_MINUTE,
    );
  });

  it("safeTrackingAuditData never includes raw origin/referer values", () => {
    const audit = safeTrackingAuditData({
      reason: "origin_not_allowed",
      requestHost: "attacker.com",
      allowedOriginsCount: 2,
      hasOrigin: true,
      hasReferer: false,
      eventName: "pageview",
      sessionId: "sess_1",
    });
    expect(audit).toEqual({
      reason: "origin_not_allowed",
      request_host: "attacker.com",
      allowed_origins_count: 2,
      has_origin: true,
      has_referer: false,
      event_name: "pageview",
      session_id: "sess_1",
    });
    // never leaks Authorization / cookies / raw payloads
    expect(JSON.stringify(audit)).not.toMatch(/authorization|cookie|token|secret/i);
  });
});
